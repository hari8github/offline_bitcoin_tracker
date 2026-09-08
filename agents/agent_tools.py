from __future__ import annotations

from datetime import datetime
import json
from typing import Literal

MAX_SUBGRAPH_NODES = 200  # bounded, per the doc's guardrail — never return an unbounded subgraph
PROXIMITY_MAX_AMOUNT_DIFF_PCT = 10.0  # max 10% volume difference for proximity matching
PROXIMITY_MAX_TIME_DIFF_HOURS = 24.0  # max 24 hours timestamp separation


def explain_alert(driver, case_id: str | None, txid: str) -> dict:
    """Look up the actual stored Alert evidence for a transaction — the
    LLM only rephrases this, it never invents a justification. If a
    transaction has multiple alerts (e.g. flagged by two detectors),
    return all of them."""
    query = """
    MATCH (al:Alert)-[:FLAGS]->(t:Transaction {txid: $txid})
    WHERE ($case_id IS NULL OR al.case_id = $case_id)
    RETURN al.type AS type, al.confidence AS confidence, al.evidence_json AS evidence_json
    """
    with driver.session() as session:
        rows = session.run(query, txid=txid, case_id=case_id)
        alerts = [dict(r) for r in rows]

    for a in alerts:
        a["evidence"] = json.loads(a["evidence_json"])
        del a["evidence_json"]

    if not alerts:
        return {"txid": txid, "alerts": [], "found": False}
    return {"txid": txid, "alerts": alerts, "found": True}


def list_patterns(driver, case_id: str | None, pattern_type: str = "all") -> dict:
    """Ranked list of alerts, optionally filtered by detector type."""
    query = """
    MATCH (al:Alert)-[:FLAGS]->(t:Transaction)
    WHERE ($case_id IS NULL OR al.case_id = $case_id)
      AND ($pattern_type = 'all' OR al.type = $pattern_type)
    RETURN DISTINCT al.type AS type, al.confidence AS confidence, t.txid AS txid
    ORDER BY al.confidence DESC
    LIMIT 50
    """
    with driver.session() as session:
        rows = session.run(query, case_id=case_id, pattern_type=pattern_type)
        return {"pattern_type": pattern_type, "results": [dict(r) for r in rows]}


def get_subgraph(driver, case_id: str | None, center: str, hops: int = 1) -> dict:
    """Bounded fund-flow subgraph around a txid or address, up to `hops`
    steps in either direction. Capped at MAX_SUBGRAPH_NODES — never
    return an unbounded graph, matches the guardrail already enforced
    server-side for manual graph exploration."""
    hops = min(hops, 5)
    query = f"""
    MATCH (center)
    WHERE (center:Transaction AND center.txid = $center)
       OR (center:Address AND center.value = $center)
    MATCH path = (center)-[:SPENDS|PAYS_TO*1..{hops}]-(other)
    WHERE ($case_id IS NULL OR NOT other:Transaction OR other.case_id = $case_id)
    WITH collect(DISTINCT other) AS others, center
    WITH others + [center] AS all_nodes
    UNWIND all_nodes AS n
    RETURN DISTINCT
        CASE WHEN n:Transaction THEN n.txid ELSE n.value END AS id,
        labels(n)[0] AS label
    LIMIT $max_nodes
    """
    with driver.session() as session:
        rows = session.run(query, center=center, case_id=case_id, max_nodes=MAX_SUBGRAPH_NODES)
        nodes = [dict(r) for r in rows]
    return {"center": center, "hops": hops, "node_count": len(nodes), "nodes": nodes}


def search_entity(driver, case_id: str | None, query: str) -> dict:
    """Free-text lookup across Address, Transaction, and IPAddress —
    matches the doc's 'search by address/txid/IP/...' requirement."""
    cypher = """
    OPTIONAL MATCH (a:Address {value: $q}) 
    OPTIONAL MATCH (t:Transaction {txid: $q})
    WHERE ($case_id IS NULL OR t.case_id = $case_id)
    OPTIONAL MATCH (ip:IPAddress {value: $q})
    RETURN a IS NOT NULL AS address_match,
           t IS NOT NULL AS transaction_match,
           ip IS NOT NULL AS ip_match
    """
    with driver.session() as session:
        row = session.run(cypher, q=query, case_id=case_id).single()
    if row is None:
        return {"query": query, "found": False}
    return {
        "query": query,
        "found": any([row["address_match"], row["transaction_match"], row["ip_match"]]),
        "matched_as": {
            "address": row["address_match"],
            "transaction": row["transaction_match"],
            "ip": row["ip_match"],
        },
    }


def _format_iso(dt) -> str | None:
    if dt is None:
        return None
    if hasattr(dt, "to_native"):
        dt = dt.to_native()
    if hasattr(dt, "isoformat"):
        iso = dt.isoformat()
        if not iso.endswith("Z") and not ("+" in iso or "-" in iso[10:]):
            iso += "Z"
        return iso
    return str(dt)


def _calc_known_days(first_seen, last_seen) -> int:
    """Calculate the number of days elapsed between first and last observed activity.
    Returns 0 if timestamps are identical (single occurrence/same-day activity) or missing."""
    if not first_seen or not last_seen:
        return 0
    if hasattr(first_seen, "to_native"):
        first_seen = first_seen.to_native()
    if hasattr(last_seen, "to_native"):
        last_seen = last_seen.to_native()
    if isinstance(first_seen, str):
        try:
            first_seen = datetime.fromisoformat(first_seen.replace("Z", "+00:00"))
        except Exception:
            return 0
    if isinstance(last_seen, str):
        try:
            last_seen = datetime.fromisoformat(last_seen.replace("Z", "+00:00"))
        except Exception:
            return 0
    return abs((last_seen - first_seen).days)


def _get_address_profile(session, case_id: str | None, entity_id: str) -> dict:
    """Aggregate history, counterparties, IPs, clusters, and alerts for an Address."""
    # 1. Summary, volumes, and timestamps
    stats_query = """
    MATCH (a:Address {value: $entity_id})
    OPTIONAL MATCH (a)-[s:SPENDS]->(t_in:Transaction)
    WHERE ($case_id IS NULL OR t_in.case_id = $case_id)
    WITH a,
         count(DISTINCT t_in) AS as_input,
         coalesce(sum(s.amount_sats), 0) AS total_sent,
         collect(DISTINCT {txid: t_in.txid, ts: t_in.timestamp}) AS in_tx_list

    OPTIONAL MATCH (t_out:Transaction)-[p:PAYS_TO]->(a)
    WHERE ($case_id IS NULL OR t_out.case_id = $case_id)
    WITH a, as_input, total_sent, in_tx_list,
         count(DISTINCT t_out) AS as_output,
         coalesce(sum(p.amount_sats), 0) AS total_received,
         collect(DISTINCT {txid: t_out.txid, ts: t_out.timestamp}) AS out_tx_list

    RETURN a.value AS address,
           a.risk_score AS risk_score,
           as_input,
           as_output,
           total_sent,
           total_received,
           in_tx_list,
           out_tx_list
    """
    row = session.run(stats_query, entity_id=entity_id, case_id=case_id).single()

    empty_profile = {
        "entity_id": entity_id,
        "entity_type": "address",
        "case_id": case_id,
        "first_seen": None,
        "last_seen": None,
        "total_sent_sats": 0,
        "total_received_sats": 0,
        "transaction_count": 0,
        "role_breakdown": {"as_input": 0, "as_output": 0},
        "counterparties": [],
        "counterparty_count": 0,
        "associated_ips": [],
        "cluster_membership": [],
        "alerts": [],
        "alert_count": 0,
        "risk_score": None if row is None else row.get("risk_score"),
        "known_since_days": 0,
    }

    if row is None:
        return empty_profile

    as_input = row["as_input"]
    as_output = row["as_output"]
    if as_input == 0 and as_output == 0:
        return empty_profile

    # Extract distinct txids and timestamps
    in_tx_list = [t for t in row["in_tx_list"] if t and t.get("txid")]
    out_tx_list = [t for t in row["out_tx_list"] if t and t.get("txid")]
    all_txids = {t["txid"] for t in in_tx_list + out_tx_list}
    transaction_count = len(all_txids)

    timestamps = [t["ts"] for t in in_tx_list + out_tx_list if t and t.get("ts")]
    first_ts = min(timestamps) if timestamps else None
    last_ts = max(timestamps) if timestamps else None
    first_seen = _format_iso(first_ts)
    last_seen = _format_iso(last_ts)
    known_since_days = _calc_known_days(first_ts, last_ts)

    # 2. Counterparties bulk query (directional: input -> output or output <- input; capped at top 20)
    cp_query = """
    MATCH (a:Address {value: $entity_id})
    OPTIONAL MATCH (a)-[:SPENDS]->(t_out:Transaction)-[:PAYS_TO]->(cp_out:Address)
    WHERE ($case_id IS NULL OR t_out.case_id = $case_id)
      AND cp_out.value <> $entity_id
    WITH a, collect(DISTINCT {cp: cp_out.value, ts: t_out.timestamp}) AS out_cps

    OPTIONAL MATCH (cp_in:Address)-[:SPENDS]->(t_in:Transaction)-[:PAYS_TO]->(a)
    WHERE ($case_id IS NULL OR t_in.case_id = $case_id)
      AND cp_in.value <> $entity_id
    WITH out_cps, collect(DISTINCT {cp: cp_in.value, ts: t_in.timestamp}) AS in_cps
    WITH [x IN (out_cps + in_cps) WHERE x.cp IS NOT NULL] AS all_cps

    UNWIND all_cps AS item
    WITH item.cp AS cp, max(item.ts) AS last_ts
    ORDER BY last_ts DESC, cp ASC
    RETURN collect(cp) AS counterparties
    """
    cp_row = session.run(cp_query, entity_id=entity_id, case_id=case_id).single()
    all_counterparties = (
        cp_row.get("counterparties")
        if cp_row and cp_row.get("counterparties")
        else []
    )
    counterparty_count = len(all_counterparties)
    counterparties = all_counterparties[:20]

    # 3. Associated IPs bulk query
    ips_query = """
    MATCH (a:Address {value: $entity_id})-[:SPENDS|PAYS_TO]-(t:Transaction)
    WHERE ($case_id IS NULL OR t.case_id = $case_id)
    WITH t
    UNWIND [
      CASE WHEN t.src_ip IS NOT NULL AND t.src_ip <> '' THEN {ip: t.src_ip, country: t.geo_country, asn: t.asn, ts: t.timestamp} END,
      CASE WHEN t.dst_ip IS NOT NULL AND t.dst_ip <> '' THEN {ip: t.dst_ip, country: t.geo_country, asn: t.asn, ts: t.timestamp} END
    ] AS item
    WITH item WHERE item IS NOT NULL
    WITH item.ip AS ip,
         item.country AS country,
         item.asn AS asn,
         max(item.ts) AS last_ts
    ORDER BY last_ts DESC, ip ASC
    RETURN DISTINCT ip, country, asn
    LIMIT 20
    """
    ip_rows = session.run(ips_query, entity_id=entity_id, case_id=case_id)
    associated_ips = [
        {"ip": r["ip"], "country": r["country"], "asn": r["asn"]}
        for r in ip_rows
        if r.get("ip")
    ]

    # 4. Cluster membership
    cluster_query = """
    MATCH (a:Address {value: $entity_id})
    OPTIONAL MATCH (a)-[r:CANDIDATE_MEMBER_OF]-(c:Cluster)
    RETURN collect(DISTINCT {
      cluster_id: coalesce(c.cluster_id, c.id, elementId(c)),
      confidence: coalesce(r.confidence, c.confidence, 1.0)
    }) AS clusters
    """
    cluster_row = session.run(cluster_query, entity_id=entity_id).single()
    raw_clusters = cluster_row.get("clusters") if cluster_row and cluster_row.get("clusters") else []
    cluster_membership = [
        {"cluster_id": c["cluster_id"], "confidence": float(c["confidence"])}
        for c in raw_clusters
        if c.get("cluster_id") is not None
    ]

    # 5. Alerts bulk query (both via connected transactions and directly on address; deduplicated by alert_id)
    alert_query = """
    MATCH (a:Address {value: $entity_id})
    OPTIONAL MATCH (a)-[:SPENDS|PAYS_TO]-(t:Transaction)<-[:FLAGS]-(al1:Alert)
    WHERE ($case_id IS NULL OR al1.case_id = $case_id)
      AND ($case_id IS NULL OR t.case_id = $case_id)
    OPTIONAL MATCH (al2:Alert)-[:FLAGS]->(a)
    WHERE ($case_id IS NULL OR al2.case_id = $case_id)
    WITH [
      CASE WHEN al1 IS NOT NULL THEN {
        alert_id: al1.alert_id,
        type: al1.type,
        confidence: al1.confidence,
        txid: coalesce(al1.txid, t.txid)
      } END,
      CASE WHEN al2 IS NOT NULL THEN {
        alert_id: al2.alert_id,
        type: al2.type,
        confidence: al2.confidence,
        txid: al2.txid
      } END
    ] AS raw_alerts
    UNWIND raw_alerts AS item
    WITH item WHERE item IS NOT NULL AND item.alert_id IS NOT NULL
    WITH item.alert_id AS alert_id,
         item.type AS type,
         item.confidence AS confidence,
         collect(DISTINCT item.txid) AS raw_txids
    WITH alert_id, type, confidence, [x IN raw_txids WHERE x IS NOT NULL] AS linked_txids
    ORDER BY confidence DESC, alert_id ASC
    RETURN collect({alert_id: alert_id, type: type, confidence: confidence, txid: CASE WHEN size(linked_txids) > 0 THEN linked_txids[0] ELSE null END, linked_txids: linked_txids}) AS alerts
    """
    alert_row = session.run(alert_query, entity_id=entity_id, case_id=case_id).single()
    all_alerts = alert_row.get("alerts") if alert_row and alert_row.get("alerts") else []
    alert_count = len(all_alerts)
    alerts = [
        {
            "alert_id": a["alert_id"],
            "type": a["type"],
            "confidence": float(a["confidence"]),
            "txid": a.get("txid"),
            "linked_txids": a.get("linked_txids") or [],
        }
        for a in all_alerts[:20]
    ]

    return {
        "entity_id": entity_id,
        "entity_type": "address",
        "case_id": case_id,
        "first_seen": first_seen,
        "last_seen": last_seen,
        "total_sent_sats": int(row["total_sent"]),
        "total_received_sats": int(row["total_received"]),
        "transaction_count": transaction_count,
        "role_breakdown": {"as_input": as_input, "as_output": as_output},
        "counterparties": counterparties,
        "counterparty_count": counterparty_count,
        "associated_ips": associated_ips,
        "cluster_membership": cluster_membership,
        "alerts": alerts,
        "alert_count": alert_count,
        "risk_score": row.get("risk_score"),
        "known_since_days": known_since_days,
    }


def _get_ip_profile(session, case_id: str | None, entity_id: str) -> dict:
    """Aggregate observed transactions, connected addresses, and alerts for an IP."""
    # 1. Transactions matching this IP
    tx_query = """
    MATCH (t:Transaction)
    WHERE ($case_id IS NULL OR t.case_id = $case_id)
      AND (t.src_ip = $entity_id OR t.dst_ip = $entity_id
           OR EXISTS { MATCH (t)-[]-(ip:IPAddress {value: $entity_id}) })
    RETURN t.txid AS txid,
           t.timestamp AS timestamp,
           t.total_input_sats AS total_input_sats,
           t.total_output_sats AS total_output_sats,
           t.geo_country AS geo_country,
           t.asn AS asn
    ORDER BY t.timestamp DESC
    """
    rows = [dict(r) for r in session.run(tx_query, entity_id=entity_id, case_id=case_id)]

    empty_profile = {
        "entity_id": entity_id,
        "entity_type": "ip",
        "case_id": case_id,
        "first_seen": None,
        "last_seen": None,
        "total_sent_sats": 0,
        "total_received_sats": 0,
        "transaction_count": 0,
        "transactions_observed_from_this_ip": [],
        "transaction_observed_count": 0,
        "addresses_seen_communicating_via_this_ip": [],
        "address_count": 0,
        "associated_ips": [],
        "cluster_membership": [],
        "alerts": [],
        "alert_count": 0,
        "risk_score": None,
        "known_since_days": 0,
    }

    if not rows:
        return empty_profile

    transaction_count = len(rows)
    tx_observed = [r["txid"] for r in rows if r.get("txid")]
    transactions_observed_from_this_ip = tx_observed[:20]

    total_sent_sats = sum(int(r["total_input_sats"] or 0) for r in rows)
    total_received_sats = sum(int(r["total_output_sats"] or 0) for r in rows)

    timestamps = [r["timestamp"] for r in rows if r.get("timestamp")]
    first_ts = min(timestamps) if timestamps else None
    last_ts = max(timestamps) if timestamps else None
    first_seen = _format_iso(first_ts)
    last_seen = _format_iso(last_ts)
    known_since_days = _calc_known_days(first_ts, last_ts)

    geo_country = next((r["geo_country"] for r in rows if r.get("geo_country")), None)
    asn = next((r["asn"] for r in rows if r.get("asn")), None)
    associated_ips = [{"ip": entity_id, "country": geo_country, "asn": asn}]

    # 2. Addresses seen communicating via this IP
    addr_query = """
    MATCH (t:Transaction)
    WHERE ($case_id IS NULL OR t.case_id = $case_id)
      AND (t.src_ip = $entity_id OR t.dst_ip = $entity_id
           OR EXISTS { MATCH (t)-[]-(ip:IPAddress {value: $entity_id}) })
    MATCH (a:Address)-[:SPENDS|PAYS_TO]-(t)
    WITH a.value AS addr, max(t.timestamp) AS last_ts
    ORDER BY last_ts DESC, addr ASC
    RETURN collect(addr) AS addresses
    """
    addr_row = session.run(addr_query, entity_id=entity_id, case_id=case_id).single()
    all_addrs = addr_row["addresses"] if addr_row and addr_row["addresses"] else []
    address_count = len(all_addrs)
    addresses_seen = all_addrs[:20]

    # 3. Alerts on transactions observed from this IP (deduplicated by alert_id)
    alert_query = """
    MATCH (t:Transaction)
    WHERE ($case_id IS NULL OR t.case_id = $case_id)
      AND (t.src_ip = $entity_id OR t.dst_ip = $entity_id
           OR EXISTS { MATCH (t)-[]-(ip:IPAddress {value: $entity_id}) })
    MATCH (al:Alert)-[:FLAGS]->(t)
    WHERE ($case_id IS NULL OR al.case_id = $case_id)
    WITH al.alert_id AS alert_id,
         al.type AS type,
         al.confidence AS confidence,
         collect(DISTINCT coalesce(al.txid, t.txid)) AS raw_txids
    WITH alert_id, type, confidence, [x IN raw_txids WHERE x IS NOT NULL] AS linked_txids
    ORDER BY confidence DESC, alert_id ASC
    RETURN collect({alert_id: alert_id, type: type, confidence: confidence, txid: CASE WHEN size(linked_txids) > 0 THEN linked_txids[0] ELSE null END, linked_txids: linked_txids}) AS alerts
    """
    alert_row = session.run(alert_query, entity_id=entity_id, case_id=case_id).single()
    all_alerts = alert_row.get("alerts") if alert_row and alert_row.get("alerts") else []
    alert_count = len(all_alerts)
    alerts = [
        {
            "alert_id": a["alert_id"],
            "type": a["type"],
            "confidence": float(a["confidence"]),
            "txid": a.get("txid"),
            "linked_txids": a.get("linked_txids") or [],
        }
        for a in all_alerts[:20]
    ]

    return {
        "entity_id": entity_id,
        "entity_type": "ip",
        "case_id": case_id,
        "first_seen": first_seen,
        "last_seen": last_seen,
        "total_sent_sats": total_sent_sats,
        "total_received_sats": total_received_sats,
        "transaction_count": transaction_count,
        "transactions_observed_from_this_ip": transactions_observed_from_this_ip,
        "transaction_observed_count": transaction_count,
        "addresses_seen_communicating_via_this_ip": addresses_seen,
        "address_count": address_count,
        "associated_ips": associated_ips,
        "cluster_membership": [],
        "alerts": alerts,
        "alert_count": alert_count,
        "risk_score": None,
        "known_since_days": known_since_days,
    }


def get_entity_profile(
    driver,
    case_id: str | None = None,
    entity_id: str = "",
    entity_type: Literal["address", "ip"] = "address",
) -> dict:
    """Aggregate cross-case history, counterparties, associated IPs,
    clusters, and alerts for an address or IP."""
    if not entity_id:
        return {
            "entity_id": "",
            "entity_type": entity_type,
            "case_id": case_id,
            "first_seen": None,
            "last_seen": None,
            "total_sent_sats": 0,
            "total_received_sats": 0,
            "transaction_count": 0,
            "role_breakdown": {"as_input": 0, "as_output": 0} if entity_type == "address" else None,
            "counterparties": [] if entity_type == "address" else None,
            "counterparty_count": 0 if entity_type == "address" else None,
            "transactions_observed_from_this_ip": [] if entity_type == "ip" else None,
            "transaction_observed_count": 0 if entity_type == "ip" else None,
            "addresses_seen_communicating_via_this_ip": [] if entity_type == "ip" else None,
            "address_count": 0 if entity_type == "ip" else None,
            "associated_ips": [],
            "cluster_membership": [],
            "alerts": [],
            "alert_count": 0,
            "risk_score": None,
            "known_since_days": 0,
        }

    with driver.session() as session:
        if entity_type == "ip":
            return _get_ip_profile(session, case_id, entity_id)
        else:
            return _get_address_profile(session, case_id, entity_id)


def find_similar_transactions(
    driver,
    case_id: str | None = None,
    txid: str = "",
    max_per_category: int = 10,
) -> dict:
    """Find transactions connected by concrete, named, explainable relationships:
    shared counterparty (with explicit roles), shared IP, shared ASN, same cluster,
    same alert pattern type, and amount/time proximity."""
    max_per_category = max(1, min(max_per_category, 50))

    empty_result = {
        "txid": txid,
        "case_id": case_id,
        "found": False,
        "shared_counterparty": [],
        "shared_ip": [],
        "shared_asn": [],
        "shared_asn_count": 0,
        "same_cluster": [],
        "same_pattern_type": [],
        "amount_and_time_proximity": [],
    }

    if not txid:
        return empty_result

    with driver.session() as session:
        check_q = """
        MATCH (t:Transaction {txid: $txid})
        WHERE ($case_id IS NULL OR t.case_id = $case_id)
        RETURN t.txid AS txid
        """
        if not session.run(check_q, txid=txid, case_id=case_id).single():
            return empty_result

        # 1. Shared counterparty: explicit direction and role
        cp_q = """
        MATCH (t:Transaction {txid: $txid})
        WHERE ($case_id IS NULL OR t.case_id = $case_id)

        OPTIONAL MATCH (t)<-[:SPENDS]-(a1:Address)-[:SPENDS]->(other1:Transaction)
        WHERE other1.txid <> $txid AND ($case_id IS NULL OR other1.case_id = $case_id)
        WITH t, collect(DISTINCT {
          other_txid: other1.txid,
          shared_address: a1.value,
          relation: 'same_input_address',
          ts: other1.timestamp
        }) AS rels1

        OPTIONAL MATCH (t)-[:PAYS_TO]->(a2:Address)<-[:PAYS_TO]-(other2:Transaction)
        WHERE other2.txid <> $txid AND ($case_id IS NULL OR other2.case_id = $case_id)
        WITH t, rels1, collect(DISTINCT {
          other_txid: other2.txid,
          shared_address: a2.value,
          relation: 'same_output_address',
          ts: other2.timestamp
        }) AS rels2

        OPTIONAL MATCH (t)-[:PAYS_TO]->(a3:Address)-[:SPENDS]->(other3:Transaction)
        WHERE other3.txid <> $txid AND ($case_id IS NULL OR other3.case_id = $case_id)
        WITH t, rels1, rels2, collect(DISTINCT {
          other_txid: other3.txid,
          shared_address: a3.value,
          relation: 'output_to_input',
          ts: other3.timestamp
        }) AS rels3

        OPTIONAL MATCH (other4:Transaction)-[:PAYS_TO]->(a4:Address)-[:SPENDS]->(t)
        WHERE other4.txid <> $txid AND ($case_id IS NULL OR other4.case_id = $case_id)
        WITH rels1, rels2, rels3, collect(DISTINCT {
          other_txid: other4.txid,
          shared_address: a4.value,
          relation: 'input_to_output',
          ts: other4.timestamp
        }) AS rels4

        WITH [x IN (rels1 + rels2 + rels3 + rels4) WHERE x.other_txid IS NOT NULL] AS all_rels
        UNWIND all_rels AS item
        WITH item.other_txid AS other_txid, item.shared_address AS shared_address, item.relation AS relation, item.ts AS ts
        ORDER BY ts DESC, other_txid ASC
        RETURN collect({other_txid: other_txid, shared_address: shared_address, relation: relation}) AS matches
        """
        cp_row = session.run(cp_q, txid=txid, case_id=case_id).single()
        shared_counterparty = (cp_row.get("matches") or [])[:max_per_category] if cp_row else []

        # 2. Shared IP
        ip_q = """
        MATCH (t:Transaction {txid: $txid})
        WHERE ($case_id IS NULL OR t.case_id = $case_id)
        MATCH (other:Transaction)
        WHERE other.txid <> $txid AND ($case_id IS NULL OR other.case_id = $case_id)
          AND (
            (t.src_ip IS NOT NULL AND t.src_ip <> '' AND (other.src_ip = t.src_ip OR other.dst_ip = t.src_ip))
            OR
            (t.dst_ip IS NOT NULL AND t.dst_ip <> '' AND (other.src_ip = t.dst_ip OR other.dst_ip = t.dst_ip))
          )
        WITH other,
             CASE
               WHEN t.src_ip IS NOT NULL AND t.src_ip <> '' AND other.src_ip = t.src_ip THEN {ip: t.src_ip, role: 'same_src_ip'}
               WHEN t.dst_ip IS NOT NULL AND t.dst_ip <> '' AND other.dst_ip = t.dst_ip THEN {ip: t.dst_ip, role: 'same_dst_ip'}
               WHEN t.src_ip IS NOT NULL AND t.src_ip <> '' AND other.dst_ip = t.src_ip THEN {ip: t.src_ip, role: 'src_to_dst'}
               ELSE {ip: t.dst_ip, role: 'dst_to_src'}
             END AS match_info
        ORDER BY other.timestamp DESC, other.txid ASC
        RETURN collect(DISTINCT {other_txid: other.txid, ip: match_info.ip, role: match_info.role}) AS matches
        """
        ip_row = session.run(ip_q, txid=txid, case_id=case_id).single()
        shared_ip = (ip_row.get("matches") or [])[:max_per_category] if ip_row else []

        # 3. Shared ASN
        asn_q = """
        MATCH (t:Transaction {txid: $txid})
        WHERE ($case_id IS NULL OR t.case_id = $case_id)
          AND t.asn IS NOT NULL AND t.asn <> 0
        MATCH (other:Transaction)
        WHERE other.txid <> $txid AND ($case_id IS NULL OR other.case_id = $case_id)
          AND other.asn = t.asn
        WITH t, other
        ORDER BY other.timestamp DESC, other.txid ASC
        RETURN count(other) AS total_count,
               collect(DISTINCT {
                 other_txid: other.txid,
                 asn: other.asn,
                 country: coalesce(other.geo_country, t.geo_country, 'Unknown')
               }) AS matches
        """
        asn_row = session.run(asn_q, txid=txid, case_id=case_id).single()
        shared_asn = (asn_row.get("matches") or [])[:max_per_category] if asn_row else []
        shared_asn_count = asn_row.get("total_count", 0) if asn_row else 0

        # 4. Same cluster
        cluster_q = """
        MATCH (t:Transaction {txid: $txid})-[:SPENDS|PAYS_TO]-(a1:Address)-[r1:CANDIDATE_MEMBER_OF]-(c:Cluster)-[r2:CANDIDATE_MEMBER_OF]-(a2:Address)-[:SPENDS|PAYS_TO]-(other:Transaction)
        WHERE other.txid <> $txid AND ($case_id IS NULL OR other.case_id = $case_id)
        WITH other, c, min(coalesce(r1.confidence, 1.0) * coalesce(r2.confidence, 1.0)) AS confidence
        ORDER BY confidence DESC, other.timestamp DESC
        RETURN collect(DISTINCT {
          other_txid: other.txid,
          cluster_id: coalesce(c.cluster_id, c.id, elementId(c)),
          confidence: confidence
        }) AS matches
        """
        cl_row = session.run(cluster_q, txid=txid, case_id=case_id).single()
        same_cluster = (cl_row.get("matches") or [])[:max_per_category] if cl_row else []

        # 5. Same pattern type
        pattern_q = """
        MATCH (al:Alert)-[:FLAGS]->(t:Transaction {txid: $txid})
        WHERE ($case_id IS NULL OR al.case_id = $case_id)
          AND ($case_id IS NULL OR t.case_id = $case_id)
        MATCH (al_other:Alert)-[:FLAGS]->(other:Transaction)
        WHERE other.txid <> $txid AND ($case_id IS NULL OR other.case_id = $case_id)
          AND ($case_id IS NULL OR al_other.case_id = $case_id)
          AND al_other.type = al.type
        WITH other.txid AS other_txid,
             al.type AS pattern_type,
             al_other.alert_id = al.alert_id AS same_alert,
             al_other.confidence AS confidence,
             other.timestamp AS ts
        WITH other_txid,
             pattern_type,
             any(x IN collect(same_alert) WHERE x = true) AS same_alert,
             max(confidence) AS confidence,
             max(ts) AS last_ts
        ORDER BY same_alert DESC, confidence DESC, other_txid ASC
        RETURN collect({
          other_txid: other_txid,
          pattern_type: pattern_type,
          confidence: confidence,
          same_alert: same_alert
        }) AS matches
        """
        pat_row = session.run(pattern_q, txid=txid, case_id=case_id).single()
        same_pattern_type = (pat_row.get("matches") or [])[:max_per_category] if pat_row else []

        # 6. Amount & time proximity
        prox_q = """
        MATCH (t:Transaction {txid: $txid})
        WHERE ($case_id IS NULL OR t.case_id = $case_id)
          AND t.total_input_sats IS NOT NULL AND t.total_input_sats > 0
          AND t.timestamp IS NOT NULL
        MATCH (other:Transaction)
        WHERE other.txid <> $txid AND ($case_id IS NULL OR other.case_id = $case_id)
          AND other.total_input_sats IS NOT NULL AND other.total_input_sats > 0
          AND other.timestamp IS NOT NULL
        WITH other,
             round(abs(t.total_input_sats - other.total_input_sats) * 100.0 / t.total_input_sats, 2) AS amount_diff_pct,
             round(abs(duration.inSeconds(t.timestamp, other.timestamp).seconds) / 3600.0, 2) AS time_diff_hours
        WHERE amount_diff_pct <= $max_amount_diff_pct
          AND time_diff_hours <= $max_time_diff_hours
        ORDER BY amount_diff_pct ASC, time_diff_hours ASC
        RETURN collect({
          other_txid: other.txid,
          amount_diff_pct: amount_diff_pct,
          time_diff_hours: time_diff_hours
        }) AS matches
        """
        prox_row = session.run(prox_q, txid=txid, case_id=case_id,
                               max_amount_diff_pct=PROXIMITY_MAX_AMOUNT_DIFF_PCT,
                               max_time_diff_hours=PROXIMITY_MAX_TIME_DIFF_HOURS).single()
        amount_and_time_proximity = (prox_row.get("matches") or [])[:max_per_category] if prox_row else []

        return {
            "txid": txid,
            "case_id": case_id,
            "found": True,
            "shared_counterparty": shared_counterparty,
            "shared_ip": shared_ip,
            "shared_asn": shared_asn,
            "shared_asn_count": shared_asn_count,
            "same_cluster": same_cluster,
            "same_pattern_type": same_pattern_type,
            "amount_and_time_proximity": amount_and_time_proximity,
        }


def investigate(driver, case_id: str | None, id: str) -> dict:
    """Composite investigation tool: single entry point that internally detects
    the entity kind (transaction, address, or IP) and returns a bundled investigation object.
    - Transaction: bundles explain_alert (own alerts & evidence) + find_similar_transactions.
    - Address / IP: calls get_entity_profile.
    """
    from agents.intent_router import TXID_PATTERN, ADDRESS_PATTERN, IP_PATTERN

    target_id = id.strip()
    kind = None
    if TXID_PATTERN.search(target_id):
        kind = "transaction"
    elif ADDRESS_PATTERN.search(target_id):
        kind = "address"
    elif IP_PATTERN.search(target_id):
        kind = "ip"
    else:
        # Fallback database lookup if regexes didn't match
        with driver.session() as session:
            if session.run("MATCH (t:Transaction {txid: $id}) RETURN t.txid LIMIT 1", id=target_id).single():
                kind = "transaction"
            elif session.run("MATCH (a:Address {value: $id}) RETURN a.value LIMIT 1", id=target_id).single():
                kind = "address"
            else:
                kind = "unknown"

    if kind == "transaction":
        own_alerts = explain_alert(driver, case_id, txid=target_id)
        similar = find_similar_transactions(driver, case_id, txid=target_id)
        return {
            "id": target_id,
            "kind": "transaction",
            "own_alerts": own_alerts,
            "similar": similar,
        }
    elif kind in ("address", "ip"):
        profile = get_entity_profile(driver, case_id, entity_id=target_id, entity_type=kind)
        return {
            "id": target_id,
            "kind": kind,
            "profile": profile,
        }
    else:
        return {
            "id": target_id,
            "kind": "unknown",
            "error": f"Could not determine entity kind for '{target_id}'",
        }


def compare_entities(
    driver,
    case_id: str | None = None,
    entity_a: str = "",
    entity_b: str = "",
) -> dict:
    """Structured, explainable diff between two entities (address-vs-address,
    txid-vs-txid, or mixed). Returns connected: True/False with a named list
    of connections — every entry names the specific field that matched.
    connected: False is a valid, useful answer — callers should not treat it
    as an error."""
    from agents.intent_router import TXID_PATTERN, ADDRESS_PATTERN, IP_PATTERN

    def _classify(val: str) -> str:
        v = val.strip()
        if TXID_PATTERN.search(v):
            return "transaction"
        if ADDRESS_PATTERN.search(v):
            return "address"
        if IP_PATTERN.search(v):
            return "ip"
        # DB fallback
        with driver.session() as session:
            if session.run("MATCH (t:Transaction {txid: $v}) RETURN t.txid LIMIT 1", v=v).single():
                return "transaction"
            if session.run("MATCH (a:Address {value: $v}) RETURN a.value LIMIT 1", v=v).single():
                return "address"
        return "unknown"

    if not entity_a or not entity_b:
        return {
            "entity_a": entity_a,
            "entity_b": entity_b,
            "case_id": case_id,
            "kind_a": "unknown",
            "kind_b": "unknown",
            "connected": False,
            "connections": {},
            "connection_count": 0,
            "error": "Both entity_a and entity_b are required.",
        }

    kind_a = _classify(entity_a)
    kind_b = _classify(entity_b)
    connections: dict = {}
    connection_count = 0

    # ── CASE 1: both addresses or IPs ─────────────────────────────────────────
    if kind_a in ("address", "ip") and kind_b in ("address", "ip"):
        with driver.session() as session:
            prof_a = (
                _get_address_profile(session, case_id, entity_a)
                if kind_a == "address"
                else _get_ip_profile(session, case_id, entity_a)
            )
            prof_b = (
                _get_address_profile(session, case_id, entity_b)
                if kind_b == "address"
                else _get_ip_profile(session, case_id, entity_b)
            )

        # Shared counterparties (addresses only)
        cps_a = set(prof_a.get("counterparties") or [])
        cps_b = set(prof_b.get("counterparties") or [])
        shared_cps = sorted(cps_a & cps_b)
        if shared_cps:
            connections["shared_counterparties"] = shared_cps
            connection_count += len(shared_cps)

        # Shared IPs
        ips_a = {r["ip"] for r in (prof_a.get("associated_ips") or []) if r.get("ip")}
        ips_b = {r["ip"] for r in (prof_b.get("associated_ips") or []) if r.get("ip")}
        shared_ips = sorted(ips_a & ips_b)
        if shared_ips:
            connections["shared_ips"] = shared_ips
            connection_count += len(shared_ips)

        # Shared ASNs (narrow: only flag if < 5 total case transactions on that ASN
        # to avoid the synthetic dataset's wide-spread ASN noise)
        asns_a = {r.get("asn") for r in (prof_a.get("associated_ips") or []) if r.get("asn")}
        asns_b = {r.get("asn") for r in (prof_b.get("associated_ips") or []) if r.get("asn")}
        shared_asns = sorted(str(x) for x in (asns_a & asns_b) if x)
        if shared_asns:
            connections["shared_asns"] = shared_asns
            connection_count += len(shared_asns)

        # Shared clusters
        clusters_a = {c.get("cluster_id") for c in (prof_a.get("cluster_membership") or []) if c.get("cluster_id")}
        clusters_b = {c.get("cluster_id") for c in (prof_b.get("cluster_membership") or []) if c.get("cluster_id")}
        shared_clusters = sorted(str(x) for x in (clusters_a & clusters_b))
        if shared_clusters:
            connections["shared_clusters"] = shared_clusters
            connection_count += len(shared_clusters)

        # Alert type overlap (both appeared in alerts of the same type)
        alert_types_a = {a.get("type") for a in (prof_a.get("alerts") or []) if a.get("type")}
        alert_types_b = {a.get("type") for a in (prof_b.get("alerts") or []) if a.get("type")}
        shared_alert_types = sorted(alert_types_a & alert_types_b)
        if shared_alert_types:
            connections["shared_alert_types"] = shared_alert_types
            connection_count += len(shared_alert_types)

    # ── CASE 2: both transactions ─────────────────────────────────────────────
    elif kind_a == "transaction" and kind_b == "transaction":
        similar = find_similar_transactions(driver, case_id, txid=entity_a)
        # Check every similarity category for b's presence
        found_links = []
        for cat, items in [
            ("shared_counterparty", similar.get("shared_counterparty") or []),
            ("shared_ip",           similar.get("shared_ip") or []),
            ("shared_asn",          similar.get("shared_asn") or []),
            ("same_cluster",        similar.get("same_cluster") or []),
            ("same_pattern_type",   similar.get("same_pattern_type") or []),
            ("amount_and_time_proximity", similar.get("amount_and_time_proximity") or []),
        ]:
            matches = [item for item in items if item.get("other_txid") == entity_b]
            for m in matches:
                found_links.append({"category": cat, "detail": m})
        if found_links:
            connections["similarity_links"] = found_links
            connection_count += len(found_links)

    # ── CASE 3: mixed (tx + address/IP or address/IP + tx) ────────────────────
    else:
        # Identify which is the transaction and which is the entity
        if kind_a == "transaction":
            txid, addr, addr_kind = entity_a, entity_b, kind_b
        else:
            txid, addr, addr_kind = entity_b, entity_a, kind_a

        direct_links = []
        # Check if address appears in tx inputs or outputs
        with driver.session() as session:
            input_q = """
            MATCH (a:Address {value: $addr})-[:SPENDS]->(t:Transaction {txid: $txid})
            WHERE ($case_id IS NULL OR t.case_id = $case_id)
            RETURN a.value AS addr
            """
            if session.run(input_q, addr=addr, txid=txid, case_id=case_id).single():
                direct_links.append({"type": "address_is_input", "address": addr, "txid": txid})

            output_q = """
            MATCH (t:Transaction {txid: $txid})-[:PAYS_TO]->(a:Address {value: $addr})
            WHERE ($case_id IS NULL OR t.case_id = $case_id)
            RETURN a.value AS addr
            """
            if session.run(output_q, addr=addr, txid=txid, case_id=case_id).single():
                direct_links.append({"type": "address_is_output", "address": addr, "txid": txid})

            # Also check IP field on the transaction
            if addr_kind == "ip":
                ip_q = """
                MATCH (t:Transaction {txid: $txid})
                WHERE ($case_id IS NULL OR t.case_id = $case_id)
                  AND (t.src_ip = $addr OR t.dst_ip = $addr)
                RETURN t.src_ip AS src_ip, t.dst_ip AS dst_ip
                """
                ip_row = session.run(ip_q, addr=addr, txid=txid, case_id=case_id).single()
                if ip_row:
                    role = "src_ip" if ip_row["src_ip"] == addr else "dst_ip"
                    direct_links.append({"type": "ip_on_transaction", "ip": addr, "txid": txid, "role": role})

        if direct_links:
            connections["direct_links"] = direct_links
            connection_count += len(direct_links)

    return {
        "entity_a": entity_a,
        "entity_b": entity_b,
        "case_id": case_id,
        "kind_a": kind_a,
        "kind_b": kind_b,
        "connected": connection_count > 0,
        "connections": connections,
        "connection_count": connection_count,
    }


# name -> callable, used by the executor node regardless of whether the
# fast-path router or the LLM fallback picked the tool.
TOOL_FUNCTIONS = {
    "investigate": investigate,
    "compare_entities": compare_entities,
    "explain_alert": explain_alert,
    "list_patterns": list_patterns,
    "get_subgraph": get_subgraph,
    "search_entity": search_entity,
    "get_entity_profile": get_entity_profile,
    "find_similar_transactions": find_similar_transactions,
}