from __future__ import annotations

import json

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


# name -> callable, used by the executor node regardless of whether the
# fast-path router or the LLM fallback picked the tool.
TOOL_FUNCTIONS = {
    "explain_alert": explain_alert,
    "list_patterns": list_patterns,
    "get_subgraph": get_subgraph,
    "search_entity": search_entity,
}