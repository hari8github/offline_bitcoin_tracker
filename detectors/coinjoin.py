from __future__ import annotations

import json

# Bounds — keep queries fast and results reviewable even on larger graphs.
MIN_INPUTS = 3
MIN_OUTPUTS = 3
VALUE_TOLERANCE = 0.05  # outputs within 5% of each other count as "equal"


_CANDIDATE_QUERY = """
MATCH (a:Address)-[:SPENDS]->(t:Transaction)
WHERE ($case_id IS NULL OR t.case_id = $case_id)
WITH t, count(a) AS n_in
WHERE n_in >= $min_inputs
MATCH (t)-[p:PAYS_TO]->(b:Address)
WITH t, n_in, collect(p.amount_sats) AS out_amounts
WHERE size(out_amounts) >= $min_outputs
RETURN t.txid AS txid, t.case_id AS case_id, n_in AS input_count, out_amounts
"""


def fetch_candidates(driver, case_id: str | None = None) -> list[dict]:
    """Pull every transaction with enough inputs/outputs to even be
    considered. Filtering (count + case_id) happens in Cypher, at the
    DB layer; value-similarity scoring happens in Python (easier to
    test/tune without touching the query)."""
    params = {"min_inputs": MIN_INPUTS, "min_outputs": MIN_OUTPUTS, "case_id": case_id}
    with driver.session() as session:
        rows = session.run(_CANDIDATE_QUERY, **params)
        return [dict(r) for r in rows]


def compute_confidence(input_count: int, output_count: int, out_amounts: list[int]) -> float:
    """0.0-1.0 confidence that a transaction is CoinJoin-like.
    Two components: how tightly outputs cluster in value, and how close
    input/output counts are to each other (real CoinJoins tend to have
    roughly matched in/out counts, one output per participant)."""
    if not out_amounts:
        return 0.0

    max_amt, min_amt = max(out_amounts), min(out_amounts)
    if max_amt == 0:
        return 0.0

    # 1.0 when all outputs are identical, drops off as spread grows.
    spread_ratio = (max_amt - min_amt) / max_amt
    value_similarity = max(0.0, 1.0 - (spread_ratio / VALUE_TOLERANCE))
    value_similarity = min(value_similarity, 1.0)

    # 1.0 when input_count == output_count, decays as they diverge.
    count_balance = 1.0 - abs(input_count - output_count) / max(input_count, output_count)

    confidence = round(0.7 * value_similarity + 0.3 * count_balance, 2)
    return max(0.0, min(confidence, 1.0))


def detect_coinjoin(driver, case_id: str | None = None, min_confidence: float = 0.5) -> list[dict]:
    """Run the full detector: fetch candidates, score, keep only
    results above min_confidence. Returns alert dicts with deterministic
    IDs (case + txid + detector type) so MERGE updates the same node on
    rerun instead of creating duplicates."""
    alerts = []
    for c in fetch_candidates(driver, case_id=case_id):
        confidence = compute_confidence(c["input_count"], len(c["out_amounts"]), c["out_amounts"])
        if confidence < min_confidence:
            continue

        cid = c["case_id"] or "default"
        alert_id = f"alert_{cid}_{c['txid']}_coinjoin_like"

        alerts.append(
            {
                "alert_id": alert_id,
                "type": "coinjoin_like",
                "txid": c["txid"],
                "case_id": c["case_id"],
                "confidence": confidence,
                "evidence": {
                    "input_count": c["input_count"],
                    "output_count": len(c["out_amounts"]),
                    "output_amounts_sats": c["out_amounts"],
                },
            }
        )
    return alerts


_ENSURE_ALERT_CONSTRAINT = """
CREATE CONSTRAINT alert_id_unique IF NOT EXISTS
FOR (al:Alert) REQUIRE al.alert_id IS UNIQUE
"""

_WRITE_ALERT_QUERY = """
MATCH (t:Transaction {txid: $txid, case_id: $case_id})
MERGE (al:Alert {alert_id: $alert_id})
SET al.type = $type,
    al.case_id = $case_id,
    al.txid = $txid,
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
    """Ensure database-level uniqueness constraint on Alert.alert_id."""
    with driver.session() as session:
        session.run(_ENSURE_ALERT_CONSTRAINT)


def clear_coinjoin_alerts(driver, case_id: str | None = None) -> None:
    """Delete all existing coinjoin_like alerts for this case before
    writing a fresh batch. Deterministic alert_id + MERGE alone only
    prevents duplicate nodes for transactions that ARE in the new
    result set — it does nothing about transactions that WERE flagged
    on a previous run (different threshold, tuned logic, bugfix) but no
    longer qualify now. Without this, stale alerts sit in the graph
    forever and silently misrepresent the current analysis."""
    with driver.session() as session:
        session.run(_DELETE_STALE_ALERTS_QUERY, type="coinjoin_like", case_id=case_id)


def write_alerts(driver, alerts: list[dict], case_id: str | None = None) -> None:
    """Persist detector output as :Alert nodes linked to the flagged
    Transaction. Clears stale alerts for this case+detector first, so
    the alert set always exactly reflects the current run rather than
    accumulating results from every run ever made."""
    ensure_alert_constraints(driver)
    clear_coinjoin_alerts(driver, case_id=case_id)
    with driver.session() as session:
        for a in alerts:
            session.run(
                _WRITE_ALERT_QUERY,
                alert_id=a["alert_id"],
                type=a["type"],
                txid=a["txid"],
                case_id=a["case_id"],
                confidence=a["confidence"],
                evidence_json=json.dumps(a["evidence"]),
            )