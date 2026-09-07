from __future__ import annotations

from datetime import datetime
import json
from typing import Literal

MAX_SUBGRAPH_NODES = 200  # bounded, per the doc's guardrail — never return an unbounded subgraph


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

    # 2. Counterparties bulk query (capped at top 20, true count preserved)
    cp_query = """
    MATCH (a:Address {value: $entity_id})-[:SPENDS|PAYS_TO]-(t:Transaction)-[:SPENDS|PAYS_TO]-(other:Address)
    WHERE ($case_id IS NULL OR t.case_id = $case_id)
      AND other.value <> $entity_id
    WITH other.value AS cp, max(t.timestamp) AS last_ts
    ORDER BY last_ts DESC, cp ASC
    RETURN collect(cp) AS counterparties
    """
    cp_row = session.run(cp_query, entity_id=entity_id, case_id=case_id).single()
    all_counterparties = cp_row["counterparties"] if cp_row and cp_row["counterparties"] else []
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
    WHERE item IS NOT NULL
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
    OPTIONAL MATCH (a)-[r:BELONGS_TO|MEMBER_OF|IN_CLUSTER]-(c:Cluster)
    RETURN collect(DISTINCT {
      cluster_id: coalesce(c.cluster_id, c.id, toString(id(c))),
      confidence: coalesce(r.confidence, c.confidence, 1.0)
    }) AS clusters
    """
    cluster_row = session.run(cluster_query, entity_id=entity_id).single()
    raw_clusters = cluster_row["clusters"] if cluster_row and cluster_row["clusters"] else []
    cluster_membership = [
        {"cluster_id": c["cluster_id"], "confidence": float(c["confidence"])}
        for c in raw_clusters
        if c.get("cluster_id") is not None
    ]

    # 5. Alerts bulk query (both via connected transactions and directly on address)
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
    WITH item WHERE item IS NOT NULL
    WITH DISTINCT item.alert_id AS alert_id, item.type AS type, item.confidence AS confidence, item.txid AS txid
    ORDER BY confidence DESC, alert_id ASC
    RETURN collect({alert_id: alert_id, type: type, confidence: confidence, txid: txid}) AS alerts
    """
    alert_row = session.run(alert_query, entity_id=entity_id, case_id=case_id).single()
    all_alerts = alert_row["alerts"] if alert_row and alert_row["alerts"] else []
    alert_count = len(all_alerts)
    alerts = [
        {
            "alert_id": a["alert_id"],
            "type": a["type"],
            "confidence": float(a["confidence"]),
            "txid": a.get("txid"),
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

    # 3. Alerts on transactions observed from this IP
    alert_query = """
    MATCH (t:Transaction)
    WHERE ($case_id IS NULL OR t.case_id = $case_id)
      AND (t.src_ip = $entity_id OR t.dst_ip = $entity_id
           OR EXISTS { MATCH (t)-[]-(ip:IPAddress {value: $entity_id}) })
    MATCH (al:Alert)-[:FLAGS]->(t)
    WHERE ($case_id IS NULL OR al.case_id = $case_id)
    WITH DISTINCT al.alert_id AS alert_id, al.type AS type, al.confidence AS confidence, coalesce(al.txid, t.txid) AS txid
    ORDER BY confidence DESC, alert_id ASC
    RETURN collect({alert_id: alert_id, type: type, confidence: confidence, txid: txid}) AS alerts
    """
    alert_row = session.run(alert_query, entity_id=entity_id, case_id=case_id).single()
    all_alerts = alert_row["alerts"] if alert_row and alert_row["alerts"] else []
    alert_count = len(all_alerts)
    alerts = [
        {
            "alert_id": a["alert_id"],
            "type": a["type"],
            "confidence": float(a["confidence"]),
            "txid": a.get("txid"),
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
    # Normalize argument order for flexible invocation:
    # (driver, case_id, entity_id, entity_type) vs (driver, entity_id, entity_type, case_id)
    if entity_id in ("address", "ip") and entity_type not in ("address", "ip"):
        actual_entity_id = case_id
        actual_entity_type = entity_id
        actual_case_id = entity_type
    elif entity_id in ("address", "ip") and entity_type == "address" and case_id not in ("address", "ip", None):
        actual_entity_id = case_id
        actual_entity_type = entity_id
        actual_case_id = None
    else:
        actual_case_id = case_id
        actual_entity_id = entity_id
        actual_entity_type = entity_type

    if not actual_entity_id:
        return {
            "entity_id": "",
            "entity_type": actual_entity_type,
            "case_id": actual_case_id,
            "first_seen": None,
            "last_seen": None,
            "total_sent_sats": 0,
            "total_received_sats": 0,
            "transaction_count": 0,
            "role_breakdown": {"as_input": 0, "as_output": 0} if actual_entity_type == "address" else None,
            "counterparties": [] if actual_entity_type == "address" else None,
            "counterparty_count": 0 if actual_entity_type == "address" else None,
            "transactions_observed_from_this_ip": [] if actual_entity_type == "ip" else None,
            "transaction_observed_count": 0 if actual_entity_type == "ip" else None,
            "addresses_seen_communicating_via_this_ip": [] if actual_entity_type == "ip" else None,
            "address_count": 0 if actual_entity_type == "ip" else None,
            "associated_ips": [],
            "cluster_membership": [],
            "alerts": [],
            "alert_count": 0,
            "risk_score": None,
            "known_since_days": 0,
        }

    with driver.session() as session:
        if actual_entity_type == "ip":
            return _get_ip_profile(session, actual_case_id, actual_entity_id)
        else:
            return _get_address_profile(session, actual_case_id, actual_entity_id)


# name -> callable, used by the executor node regardless of whether the
# fast-path router or the LLM fallback picked the tool.
TOOL_FUNCTIONS = {
    "explain_alert": explain_alert,
    "list_patterns": list_patterns,
    "get_subgraph": get_subgraph,
    "search_entity": search_entity,
    "get_entity_profile": get_entity_profile,
}