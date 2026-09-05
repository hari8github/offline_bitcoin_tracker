from __future__ import annotations

import json

# Bounds — same discipline as coinjoin.py: keep traversal cheap and results reviewable.
MIN_CHAIN_LENGTH = 3            # minimum linked transactions to count as a peeling chain
MAX_HOPS = 5                    # cap on how far a single chain is followed
MAX_TIME_GAP_SECONDS = 7 * 24 * 3600  # hops further apart than this aren't treated as linked


_FETCH_TRANSACTIONS_QUERY = """
MATCH (a:Address)-[s:SPENDS]->(t:Transaction)
WHERE ($case_id IS NULL OR t.case_id = $case_id)
WITH t, collect({address: a.value, amount_sats: s.amount_sats}) AS inputs
MATCH (t)-[p:PAYS_TO]->(b:Address)
WITH t, inputs, collect({address: b.value, amount_sats: p.amount_sats}) AS outputs
RETURN t.txid AS txid, t.case_id AS case_id, t.timestamp AS timestamp,
       t.total_output_sats AS total_output_sats, inputs, outputs
"""


def _to_datetime(ts):
    """Neo4j returns its own DateTime type — normalize to native Python
    datetime so subtraction/comparison behaves predictably."""
    return ts.to_native() if hasattr(ts, "to_native") else ts


def fetch_transactions(driver, case_id: str | None = None) -> list[dict]:
    """One bulk fetch of every transaction's inputs/outputs/timestamp for
    this case. Chain-walking happens in Python afterward — simpler and
    more portable than expressing a variable-length alternating-
    relationship path directly in Cypher."""
    with driver.session() as session:
        rows = session.run(_FETCH_TRANSACTIONS_QUERY, case_id=case_id)
        transactions = [dict(r) for r in rows]
    for t in transactions:
        t["timestamp"] = _to_datetime(t["timestamp"])
    return transactions


def _dominant_output(outputs: list[dict]) -> dict | None:
    """Largest-value output — treated as the 'change' likely to continue
    the chain. Remaining output(s) are the peeled payment."""
    if not outputs:
        return None
    return max(outputs, key=lambda o: o["amount_sats"])


def build_chain_links(transactions: list[dict]) -> dict[str, str]:
    """Map txid -> next txid, where the dominant output address of one
    transaction is later spent as an input to another transaction,
    within the configured time window. Assumes a linear continuation
    (a change address is spent exactly once forward) — matches how
    peeling chains are actually constructed."""
    # address -> [(txid that spends it as input, that tx's timestamp), ...]
    spent_as_input_by: dict[str, list[tuple[str, object]]] = {}
    for t in transactions:
        for inp in t["inputs"]:
            spent_as_input_by.setdefault(inp["address"], []).append((t["txid"], t["timestamp"]))

    links: dict[str, str] = {}
    for t in transactions:
        dom = _dominant_output(t["outputs"])
        if dom is None:
            continue

        candidates = spent_as_input_by.get(dom["address"], [])
        later = [(txid, ts) for txid, ts in candidates if ts > t["timestamp"]]
        if not later:
            continue

        next_txid, next_ts = min(later, key=lambda x: x[1])
        gap_seconds = (next_ts - t["timestamp"]).total_seconds()
        if gap_seconds > MAX_TIME_GAP_SECONDS:
            continue

        links[t["txid"]] = next_txid
    return links


def extract_chains(links: dict[str, str]) -> list[list[str]]:
    """Follow links from every chain start (a txid that is never itself
    a 'next') to build maximal chains, bounded by MAX_HOPS."""
    is_target = set(links.values())
    starts = [txid for txid in links if txid not in is_target]

    chains = []
    for start in starts:
        chain = [start]
        current = start
        while current in links and len(chain) < MAX_HOPS:
            nxt = links[current]
            if nxt in chain:  # guard against a cycle
                break
            chain.append(nxt)
            current = nxt
        if len(chain) >= MIN_CHAIN_LENGTH:
            chains.append(chain)
    return chains


def compute_confidence(chain: list[str], tx_by_id: dict[str, dict]) -> float:
    """Confidence grows with chain length and how consistently value
    decreases hop to hop — the two structural signals of a real peeling
    chain. A single unrelated/mixing transaction in the sequence breaks
    both, which is the intended behavior."""
    values = [tx_by_id[txid]["total_output_sats"] for txid in chain]

    total_hops = len(values) - 1
    decreasing_hops = sum(1 for i in range(1, len(values)) if values[i] < values[i - 1])
    decrease_consistency = decreasing_hops / total_hops if total_hops else 0.0

    length_score = min(1.0, (len(chain) - MIN_CHAIN_LENGTH + 1) / (MAX_HOPS - MIN_CHAIN_LENGTH + 1))

    confidence = round(0.7 * decrease_consistency + 0.3 * length_score, 2)
    return max(0.0, min(confidence, 1.0))


def detect_peeling_chain(driver, case_id: str | None = None, min_confidence: float = 0.5) -> list[dict]:
    """Run the full detector: fetch transactions, link chains, score,
    keep only results above min_confidence."""
    transactions = fetch_transactions(driver, case_id=case_id)
    tx_by_id = {t["txid"]: t for t in transactions}

    links = build_chain_links(transactions)
    chains = extract_chains(links)

    alerts = []
    for chain in chains:
        confidence = compute_confidence(chain, tx_by_id)
        if confidence < min_confidence:
            continue

        cid = tx_by_id[chain[0]]["case_id"] or "default"
        alert_id = f"alert_{cid}_{'_'.join(chain)}_peeling_chain"

        alerts.append(
            {
                "alert_id": alert_id,
                "type": "peeling_chain",
                "txid": chain[0],  # primary txid the alert is anchored to (chain start)
                "path": chain,
                "case_id": tx_by_id[chain[0]]["case_id"],
                "confidence": confidence,
                "evidence": {
                    "path": chain,
                    "value_sequence_sats": [tx_by_id[t]["total_output_sats"] for t in chain],
                },
            }
        )
    return alerts


_ENSURE_ALERT_CONSTRAINT = """
CREATE CONSTRAINT alert_id_unique IF NOT EXISTS
FOR (al:Alert) REQUIRE al.alert_id IS UNIQUE
"""

_WRITE_ALERT_QUERY = """
UNWIND $txids AS txid
MATCH (t:Transaction {txid: txid, case_id: $case_id})
MERGE (al:Alert {alert_id: $alert_id})
SET al.type = $type,
    al.case_id = $case_id,
    al.confidence = $confidence,
    al.evidence_json = $evidence_json,
    al.updated_at = datetime()
MERGE (al)-[:FLAGS]->(t)
"""

_DELETE_STALE_ALERTS_QUERY = """
MATCH (al:Alert {type: $type})
WHERE ($case_id IS NULL OR al.case_id = $case_id)
DETACH DELETE al
"""


def ensure_alert_constraints(driver) -> None:
    with driver.session() as session:
        session.run(_ENSURE_ALERT_CONSTRAINT)


def clear_peeling_chain_alerts(driver, case_id: str | None = None) -> None:
    """Delete existing peeling_chain alerts for this case before writing
    a fresh batch — same rationale as coinjoin.py: without this, alerts
    from a previous run (different thresholds, fixed bug) linger and
    misrepresent the current analysis."""
    with driver.session() as session:
        session.run(_DELETE_STALE_ALERTS_QUERY, type="peeling_chain", case_id=case_id)


def write_alerts(driver, alerts: list[dict], case_id: str | None = None) -> None:
    """Persist detector output as :Alert nodes, each linked via :FLAGS
    to every transaction in its chain (not just the first) — an
    analyst opening any transaction in a peeling chain should see the
    same alert and full path."""
    ensure_alert_constraints(driver)
    clear_peeling_chain_alerts(driver, case_id=case_id)
    with driver.session() as session:
        for a in alerts:
            session.run(
                _WRITE_ALERT_QUERY,
                alert_id=a["alert_id"],
                type=a["type"],
                case_id=a["case_id"],
                confidence=a["confidence"],
                evidence_json=json.dumps(a["evidence"]),
                txids=a["path"],
            )