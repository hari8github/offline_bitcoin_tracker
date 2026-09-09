"""
Bitcoin Forensics – FastAPI backend (v2)
Serves the investigator console and exposes REST endpoints for
dashboard analytics, graph exploration, ingestion, and detection.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from config import DATA_DIR, DEFAULT_CASE_ID, get_neo4j_driver
from detectors.coinjoin import detect_coinjoin, write_alerts as write_coinjoin_alerts
from detectors.peeling_chain import detect_peeling_chain, write_alerts as write_peeling_alerts
from graph.dedup import dedup_batch, get_existing_txids
from graph.load_data import ingest_file, load_seed_labels
from graph.loader import ensure_constraints, load_batch
from ingestion.parsers import parse_csv_file, parse_json_file, parse_xml_file
from ingestion.validate import validate_batch
from agents.graph import build_agent, run_agent, AgentResponse
from agents.agent_schema import ConversationState
from agents.agent_tools import get_entity_profile, find_similar_transactions, compare_entities

app = FastAPI(
    title="Bitcoin Forensics API",
    description="Offline Bitcoin transaction forensics: ingest, graph, detect.",
    version="2.0.0",
)

FRONTEND_DIR = Path(__file__).resolve().parent / "frontend"


# ── Shared helpers ─────────────────────────────────────────────

def _driver():
    """Return a verified Neo4j driver or raise HTTP 503."""
    try:
        d = get_neo4j_driver()
        d.verify_connectivity()
        return d
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Neo4j unreachable: {exc}")


def _sats_to_btc(sats) -> float:
    if sats is None:
        return 0.0
    return round(int(sats) / 1e8, 8)


def _str_props(props: dict) -> dict:
    """Stringify all property values so JSON serialisation never chokes."""
    return {k: str(v) if v is not None else "" for k, v in props.items()}


# ── System ─────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
def health():
    """Neo4j connectivity check."""
    try:
        with get_neo4j_driver() as driver:
            driver.verify_connectivity()
        return {"status": "ok", "neo4j": "connected"}
    except Exception as exc:
        return JSONResponse(
            status_code=503,
            content={"status": "error", "neo4j": "unreachable", "detail": str(exc)},
        )


@app.get("/cases", tags=["System"])
def list_cases():
    """Return all distinct case IDs present in Neo4j."""
    q = "MATCH (t:Transaction) RETURN DISTINCT t.case_id AS c ORDER BY c"
    try:
        with _driver() as driver:
            with driver.session() as s:
                cases = [r["c"] for r in s.run(q) if r["c"]]
        return {"cases": cases or [DEFAULT_CASE_ID]}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Dashboard ──────────────────────────────────────────────────

@app.get("/stats", tags=["Dashboard"])
def graph_stats(case_id: str = DEFAULT_CASE_ID):
    """KPI counts: transactions, addresses, alerts, high-risk alerts."""
    try:
        with _driver() as driver:
            with driver.session() as s:
                tx   = s.run("MATCH (t:Transaction {case_id:$c}) RETURN count(t) AS n", c=case_id).single()["n"]
                addr = s.run("""
                    MATCH (a:Address)-[:SPENDS|PAYS_TO]-(t:Transaction {case_id:$c})
                    RETURN count(DISTINCT a) AS n
                """, c=case_id).single()["n"]
                alrt = s.run("MATCH (al:Alert {case_id:$c}) RETURN count(al) AS n", c=case_id).single()["n"]
                high = s.run("MATCH (al:Alert {case_id:$c}) WHERE al.confidence >= 0.8 RETURN count(al) AS n", c=case_id).single()["n"]
        return {"case_id": case_id, "transactions": tx, "addresses": addr, "alerts": alrt, "high_risk_alerts": high}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/dashboard/timeline", tags=["Dashboard"])
def dashboard_timeline(case_id: str = DEFAULT_CASE_ID):
    """Transaction count grouped by date for the volume chart."""
    q = """
    MATCH (t:Transaction {case_id:$c})
    WITH date(t.timestamp) AS d, count(t) AS cnt
    RETURN toString(d) AS date, cnt AS count
    ORDER BY d
    """
    try:
        with _driver() as driver:
            with driver.session() as s:
                rows = [{"date": r["date"], "count": r["count"]} for r in s.run(q, c=case_id)]
        return {"timeline": rows}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/dashboard/top-addresses", tags=["Dashboard"])
def top_addresses(case_id: str = DEFAULT_CASE_ID, limit: int = 10):
    """Top addresses by total received value (satoshis)."""
    q = """
    MATCH (t:Transaction {case_id:$c})-[r:PAYS_TO]->(a:Address)
    WITH a.value AS address, a.entity_name AS entity,
         a.risk_score AS risk, sum(r.amount_sats) AS total_sats
    RETURN address, entity, risk, total_sats
    ORDER BY total_sats DESC LIMIT $lim
    """
    try:
        with _driver() as driver:
            with driver.session() as s:
                rows = [
                    {
                        "address": r["address"],
                        "entity": r["entity"] or "",
                        "risk_score": r["risk"],
                        "total_sats": r["total_sats"],
                        "total_btc": _sats_to_btc(r["total_sats"]),
                    }
                    for r in s.run(q, c=case_id, lim=limit)
                ]
        return {"addresses": rows}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/dashboard/geo", tags=["Dashboard"])
def geo_distribution(case_id: str = DEFAULT_CASE_ID):
    """Geographic and ASN distribution of transactions."""
    geo_q = """
    MATCH (t:Transaction {case_id:$c})
    RETURN t.geo_country AS country, count(t) AS count
    ORDER BY count DESC LIMIT 20
    """
    asn_q = """
    MATCH (t:Transaction {case_id:$c})
    RETURN t.asn AS asn, count(t) AS count
    ORDER BY count DESC LIMIT 10
    """
    try:
        with _driver() as driver:
            with driver.session() as s:
                geo = [{"country": r["country"] or "Unknown", "count": r["count"]} for r in s.run(geo_q, c=case_id)]
                asn = [{"asn": r["asn"], "count": r["count"]} for r in s.run(asn_q, c=case_id)]
        return {"geo": geo, "asn": asn}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/dashboard/risk-exposure", tags=["Dashboard"])
def dashboard_risk_exposure(case_id: str = DEFAULT_CASE_ID):
    """
    Risk Exposure Panel:
    For every Address with risk_score set (from seed labels), compute direct BTC in/out
    and count distinct addresses reachable within 1, 2, and 3 hops (via SPENDS/PAYS_TO)
    traversing only transactions within the specified case_id.
    """
    # Scaling note: Live graph traversal is instantaneous for offline/investigation scale (~164 tx).
    # For large graph scales (>100k tx), this can be pre-computed at alert/ingest write-time into a summary projection.
    q = """
    MATCH (seed:Address)-[:SPENDS|PAYS_TO]-(t_case:Transaction {case_id: $c})
    WHERE seed.risk_score IS NOT NULL
    WITH DISTINCT seed
    OPTIONAL MATCH (seed)<-[r_in:PAYS_TO]-(t_in:Transaction {case_id: $c})
    WITH seed, coalesce(sum(r_in.amount_sats), 0) AS direct_in_sats
    OPTIONAL MATCH (seed)-[r_out:SPENDS]->(t_out:Transaction {case_id: $c})
    WITH seed, direct_in_sats, coalesce(sum(r_out.amount_sats), 0) AS direct_out_sats

    OPTIONAL MATCH path = (seed)-[:SPENDS|PAYS_TO*1..6]-(other:Address)
    WHERE other <> seed
      AND all(n IN nodes(path) WHERE (NOT n:Transaction) OR n.case_id = $c)
    WITH seed, direct_in_sats, direct_out_sats, other, min(length(path)) AS rel_len
    WITH seed, direct_in_sats, direct_out_sats,
         count(DISTINCT CASE WHEN rel_len <= 2 THEN other END) AS hop1_addrs,
         count(DISTINCT CASE WHEN rel_len <= 4 THEN other END) AS hop2_addrs,
         count(DISTINCT CASE WHEN rel_len <= 6 THEN other END) AS hop3_addrs

    RETURN seed.value AS address,
           coalesce(seed.entity_name, 'Known Seed') AS entity_name,
           seed.risk_score AS risk_score,
           direct_in_sats,
           direct_out_sats,
           hop1_addrs,
           hop2_addrs,
           hop3_addrs
    ORDER BY seed.risk_score DESC, (direct_in_sats + direct_out_sats) DESC
    """
    try:
        with _driver() as driver:
            with driver.session() as s:
                rows = []
                for r in s.run(q, c=case_id):
                    in_sats = r["direct_in_sats"] or 0
                    out_sats = r["direct_out_sats"] or 0
                    rows.append({
                        "address": r["address"],
                        "entity_name": r["entity_name"],
                        "risk_score": r["risk_score"],
                        "direct_in_sats": in_sats,
                        "direct_out_sats": out_sats,
                        "direct_in_btc": _sats_to_btc(in_sats),
                        "direct_out_btc": _sats_to_btc(out_sats),
                        "total_direct_btc": _sats_to_btc(in_sats + out_sats),
                        "hop1_addrs": r["hop1_addrs"] or 0,
                        "hop2_addrs": r["hop2_addrs"] or 0,
                        "hop3_addrs": r["hop3_addrs"] or 0,
                    })
        return {"case_id": case_id, "seeds": rows}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/dashboard/structural-flags", tags=["Dashboard"])
def dashboard_structural_flags(case_id: str = DEFAULT_CASE_ID):
    """
    Structural Flags / Anomalies Panel:
    - Burst Senders: Addresses appearing as input (SPENDS) across >= 4 transactions within a 1-hour window.
    - Address Reuse Across Roles: Addresses that act as both PAYS_TO destination and subsequently SPENDS source.
    """
    q_burst = """
    MATCH (a:Address)-[:SPENDS]->(t:Transaction {case_id: $c})
    WITH a, t
    ORDER BY t.timestamp ASC
    WITH a, collect({txid: t.txid, timestamp: toString(t.timestamp), amount_sats: t.total_input_sats}) AS spends
    WHERE size(spends) >= 4
    RETURN a.value AS address, coalesce(a.entity_name, '') AS entity_name, spends
    """
    q_reuse = """
    MATCH (t1:Transaction {case_id: $c})-[r1:PAYS_TO]->(a:Address)-[r2:SPENDS]->(t2:Transaction {case_id: $c})
    WHERE t1.timestamp <= t2.timestamp
    WITH a, count(DISTINCT t1) AS received_tx_count, count(DISTINCT t2) AS spent_tx_count,
         sum(r1.amount_sats) AS received_sats, sum(r2.amount_sats) AS spent_sats
    RETURN count(a) AS total_reused_addresses,
           collect({
               address: a.value,
               entity_name: coalesce(a.entity_name, ''),
               received_tx_count: received_tx_count,
               spent_tx_count: spent_tx_count,
               received_sats: received_sats,
               spent_sats: spent_sats
           })[..10] AS sample_reused
    """
    try:
        with _driver() as driver:
            with driver.session() as s:
                burst_senders = []
                for r in s.run(q_burst, c=case_id):
                    addr = r["address"]
                    entity = r["entity_name"]
                    spends = r["spends"]
                    parsed = []
                    for sp in spends:
                        ts_str = sp.get("timestamp") or ""
                        try:
                            ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                            parsed.append((ts, sp))
                        except Exception:
                            continue

                    max_window_count = 0
                    window_spends = []
                    for i in range(len(parsed)):
                        cur_window = [parsed[i]]
                        for j in range(i + 1, len(parsed)):
                            if (parsed[j][0] - parsed[i][0]).total_seconds() <= 3600:
                                cur_window.append(parsed[j])
                            else:
                                break
                        if len(cur_window) > max_window_count:
                            max_window_count = len(cur_window)
                            window_spends = cur_window

                    if max_window_count >= 4:
                        burst_senders.append({
                            "address": addr,
                            "entity_name": entity,
                            "burst_count": max_window_count,
                            "total_spends": len(spends),
                            "window_start": window_spends[0][0].isoformat() if window_spends else "",
                            "window_end": window_spends[-1][0].isoformat() if window_spends else "",
                            "sample_txids": [w[1]["txid"] for w in window_spends[:5]],
                        })

                burst_senders.sort(key=lambda b: b["burst_count"], reverse=True)

                reuse_res = s.run(q_reuse, c=case_id).single()
                total_reused = reuse_res["total_reused_addresses"] if reuse_res else 0
                sample_reused = []
                if reuse_res and reuse_res["sample_reused"]:
                    for item in reuse_res["sample_reused"]:
                        sample_reused.append({
                            "address": item["address"],
                            "entity_name": item["entity_name"],
                            "received_tx_count": item["received_tx_count"],
                            "spent_tx_count": item["spent_tx_count"],
                            "received_btc": _sats_to_btc(item["received_sats"]),
                            "spent_btc": _sats_to_btc(item["spent_sats"]),
                        })

        return {
            "case_id": case_id,
            "burst_senders": burst_senders,
            "address_reuse": {
                "total_reused_addresses": total_reused,
                "sample_reused": sample_reused,
            },
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/dashboard/case-highlights", tags=["Dashboard"])
def dashboard_case_highlights(case_id: str = DEFAULT_CASE_ID):
    """
    Case Highlights Panel:
    Identifies the single longest peeling chain and the largest CoinJoin transaction in the case.
    """
    try:
        with _driver() as driver:
            cjs = detect_coinjoin(driver, case_id=case_id, min_confidence=0.5)
            peels = detect_peeling_chain(driver, case_id=case_id, min_confidence=0.5)

        longest_peel = None
        if peels:
            peels_sorted = sorted(peels, key=lambda p: len(p.get("path") or []), reverse=True)
            top_peel = peels_sorted[0]
            path = top_peel.get("path") or []
            vals = top_peel.get("evidence", {}).get("value_sequence_sats") or []
            peeled_off_sats = (vals[0] - vals[-1]) if len(vals) >= 2 else 0
            longest_peel = {
                "alert_id": top_peel.get("alert_id", ""),
                "txid": top_peel.get("txid", ""),
                "confidence": top_peel.get("confidence", 0.0),
                "chain_length": len(path),
                "path": path,
                "start_txid": path[0] if path else "",
                "end_txid": path[-1] if path else "",
                "peeled_off_sats": peeled_off_sats,
                "peeled_off_btc": _sats_to_btc(peeled_off_sats),
                "start_balance_btc": _sats_to_btc(vals[0]) if vals else 0.0,
                "end_balance_btc": _sats_to_btc(vals[-1]) if vals else 0.0,
            }

        largest_cj = None
        if cjs:
            cjs_sorted = sorted(cjs, key=lambda c: c.get("evidence", {}).get("input_count", 0), reverse=True)
            top_cj = cjs_sorted[0]
            ev = top_cj.get("evidence", {})
            amounts = ev.get("output_amounts_sats") or []
            largest_cj = {
                "alert_id": top_cj.get("alert_id", ""),
                "txid": top_cj.get("txid", ""),
                "confidence": top_cj.get("confidence", 0.0),
                "input_count": ev.get("input_count", 0),
                "output_count": ev.get("output_count", 0),
                "equal_output_count": len(amounts),
                "denomination_btc": _sats_to_btc(amounts[0]) if amounts else 0.0,
                "total_btc": _sats_to_btc(sum(amounts)) if amounts else 0.0,
            }

        return {
            "case_id": case_id,
            "longest_peeling_chain": longest_peel,
            "largest_coinjoin": largest_cj,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/dashboard/fee-outliers", tags=["Dashboard"])
def dashboard_fee_outliers(case_id: str = DEFAULT_CASE_ID):
    """
    Fee Outliers Panel:
    Computes mean and standard deviation of transaction fees (sats).
    Identifies high-priority fee spikes (> 2 standard deviations above mean)
    and zero-fee transactions (batching / service wallets).
    """
    q = """
    MATCH (t:Transaction {case_id: $c})
    WHERE t.implied_fee_sats IS NOT NULL
    RETURN t.txid AS txid,
           t.implied_fee_sats AS fee_sats,
           t.total_input_sats AS input_sats,
           t.total_output_sats AS output_sats,
           toString(t.timestamp) AS timestamp
    ORDER BY fee_sats DESC
    """
    try:
        with _driver() as driver:
            with driver.session() as s:
                rows = [dict(r) for r in s.run(q, c=case_id)]

        if not rows:
            return {
                "case_id": case_id,
                "total_tx_with_fees": 0,
                "mean_fee_sats": 0.0,
                "mean_fee_btc": 0.0,
                "stddev_fee_sats": 0.0,
                "stddev_fee_btc": 0.0,
                "high_threshold_sats": 0.0,
                "high_threshold_btc": 0.0,
                "high_outliers": [],
                "zero_fee_transactions": [],
            }

        fees = [r["fee_sats"] for r in rows]
        n = len(fees)
        mean = sum(fees) / n
        variance = sum((x - mean) ** 2 for x in fees) / n
        stddev = variance ** 0.5
        threshold = mean + 2 * stddev

        high_outliers = [
            {
                "txid": r["txid"],
                "fee_sats": r["fee_sats"],
                "fee_btc": _sats_to_btc(r["fee_sats"]),
                "input_btc": _sats_to_btc(r["input_sats"]),
                "output_btc": _sats_to_btc(r["output_sats"]),
                "timestamp": r["timestamp"],
                "fee_rate_pct": round((r["fee_sats"] / r["input_sats"] * 100), 2) if r["input_sats"] else 0.0,
                "sigma_score": round((r["fee_sats"] - mean) / stddev, 2) if stddev > 0 else 0.0,
                "type": "high_fee",
            }
            for r in rows if r["fee_sats"] > threshold
        ]

        zero_fees = [
            {
                "txid": r["txid"],
                "fee_sats": 0,
                "fee_btc": 0.0,
                "input_btc": _sats_to_btc(r["input_sats"]),
                "output_btc": _sats_to_btc(r["output_sats"]),
                "timestamp": r["timestamp"],
                "type": "zero_fee",
            }
            for r in rows if r["fee_sats"] == 0
        ]

        return {
            "case_id": case_id,
            "total_tx_with_fees": n,
            "mean_fee_sats": round(mean, 2),
            "mean_fee_btc": _sats_to_btc(mean),
            "stddev_fee_sats": round(stddev, 2),
            "stddev_fee_btc": _sats_to_btc(stddev),
            "high_threshold_sats": round(threshold, 2),
            "high_threshold_btc": _sats_to_btc(threshold),
            "high_outliers": high_outliers,
            "zero_fee_transactions": zero_fees,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Graph ──────────────────────────────────────────────────────

@app.get("/graph/search", tags=["Graph"])
def graph_search(q: str, case_id: str = DEFAULT_CASE_ID, limit: int = 20):
    """
    Free-text search across txids, addresses, IPs, ASNs, countries, entities, alert IDs.
    Returns a flat list of matching nodes (id, type, label, props).
    """
    term = q.strip()
    q_tx = """
    MATCH (t:Transaction {case_id:$c})
    WHERE t.txid CONTAINS $q OR t.src_ip CONTAINS $q OR t.dst_ip CONTAINS $q
       OR t.geo_country CONTAINS $q OR toString(t.asn) = $q
    RETURN t.txid AS id, 'Transaction' AS type, t.txid AS label, properties(t) AS props
    LIMIT $lim
    """
    q_addr = """
    MATCH (a:Address)
    WHERE a.value CONTAINS $q OR coalesce(a.entity_name,'') CONTAINS $q
    RETURN a.value AS id, 'Address' AS type, a.value AS label, properties(a) AS props
    LIMIT $lim
    """
    q_alert = """
    MATCH (al:Alert {case_id:$c})
    WHERE al.alert_id CONTAINS $q OR al.txid CONTAINS $q
    RETURN al.alert_id AS id, 'Alert' AS type, al.alert_id AS label, properties(al) AS props
    LIMIT $lim
    """
    try:
        results = []
        seen = set()
        with _driver() as driver:
            with driver.session() as s:
                for query in (q_tx, q_addr, q_alert):
                    for r in s.run(query, c=case_id, q=term, lim=limit):
                        if r["id"] not in seen:
                            seen.add(r["id"])
                            results.append({
                                "id": r["id"],
                                "type": r["type"],
                                "label": r["label"],
                                "props": _str_props(dict(r["props"])),
                            })
        return {"query": q, "count": len(results), "results": results[:limit]}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/entity/profile", tags=["Graph"])
def entity_profile(
    entity_id: str,
    entity_type: str = "address",
    case_id: str = DEFAULT_CASE_ID,
):
    """
    Aggregate cross-case history, counterparties, associated IPs,
    clusters, and alerts for an address or IP.
    """
    if entity_type not in ("address", "ip"):
        raise HTTPException(status_code=400, detail="entity_type must be 'address' or 'ip'")
    try:
        with _driver() as driver:
            return get_entity_profile(driver, case_id=case_id, entity_id=entity_id, entity_type=entity_type)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/transactions/{txid}/similar", tags=["Graph"])
def similar_transactions(
    txid: str,
    case_id: str = DEFAULT_CASE_ID,
    max_per_category: int = Query(10, ge=1, le=50),
):
    """
    Find transactions connected by concrete, named, explainable relationships:
    shared counterparty, shared IP, shared ASN, same cluster, same pattern type,
    and amount/time proximity.
    """
    try:
        with _driver() as driver:
            return find_similar_transactions(
                driver,
                case_id=case_id,
                txid=txid,
                max_per_category=max_per_category,
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/entities/compare", tags=["Graph"])
def compare_entities_endpoint(
    entity_a: str,
    entity_b: str,
    case_id: str = DEFAULT_CASE_ID,
):
    """
    Structured, explainable diff between two entities (address-vs-address,
    txid-vs-txid, or mixed). Returns connected: true/false with a named list
    of connections — every connection field is explicitly named.
    connected: false is a valid answer, not an error.
    """
    try:
        with _driver() as driver:
            return compare_entities(
                driver,
                case_id=case_id,
                entity_a=entity_a,
                entity_b=entity_b,
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))



@app.get("/graph/subgraph", tags=["Graph"])
def graph_subgraph(
    node_id: str,
    node_type: str = "Transaction",
    case_id: str = DEFAULT_CASE_ID,
    max_nodes: int = Query(200, le=500),
):
    """
    Return the one-hop neighbourhood around a node as
    {nodes: [...], edges: [...]} in Cytoscape.js element format.
    """
    nodes: dict[str, dict] = {}
    edges: list[dict] = []

    def _risk_class(risk) -> str:
        if risk is None:
            return ""
        r = float(risk)
        return "risk-high" if r >= 0.7 else "risk-med" if r >= 0.4 else "risk-low"

    def _addr(val, props: dict):
        if not val or val in nodes:
            return
        p = props or {}
        nodes[val] = {
            "id": val,
            "label": (val[:12] + "…") if len(val) > 12 else val,
            "type": "Address",
            "riskClass": _risk_class(p.get("risk_score")),
            "props": _str_props(p),
        }

    def _tx(txid, props: dict):
        if not txid or txid in nodes:
            return
        nodes[txid] = {
            "id": txid,
            "label": (txid[:14] + "…") if len(txid) > 14 else txid,
            "type": "Transaction",
            "props": _str_props(props or {}),
        }

    def _alert(aid, props: dict):
        if not aid or aid in nodes:
            return
        nodes[aid] = {
            "id": aid,
            "label": "⚠ Alert",
            "type": "Alert",
            "props": _str_props(props or {}),
        }

    try:
        with _driver() as driver:
            with driver.session() as s:

                if node_type == "Transaction":
                    row = s.run("MATCH (t:Transaction {txid:$n,case_id:$c}) RETURN properties(t) AS p", n=node_id, c=case_id).single()
                    if row:
                        _tx(node_id, dict(row["p"]))

                    for r in s.run(
                        "MATCH (a:Address)-[rel:SPENDS]->(t:Transaction {txid:$n,case_id:$c}) RETURN a.value AS av, properties(a) AS ap, rel.amount_sats AS amt",
                        n=node_id, c=case_id,
                    ):
                        _addr(r["av"], dict(r["ap"] or {}))
                        if r["av"]:
                            edges.append({"id": f"s_{r['av']}_{node_id}", "source": r["av"], "target": node_id,
                                          "type": "SPENDS", "amount_sats": r["amt"], "amount_btc": _sats_to_btc(r["amt"])})

                    for r in s.run(
                        "MATCH (t:Transaction {txid:$n,case_id:$c})-[rel:PAYS_TO]->(b:Address) RETURN b.value AS bv, properties(b) AS bp, rel.amount_sats AS amt",
                        n=node_id, c=case_id,
                    ):
                        _addr(r["bv"], dict(r["bp"] or {}))
                        if r["bv"]:
                            edges.append({"id": f"p_{node_id}_{r['bv']}", "source": node_id, "target": r["bv"],
                                          "type": "PAYS_TO", "amount_sats": r["amt"], "amount_btc": _sats_to_btc(r["amt"])})

                    for r in s.run(
                        "MATCH (al:Alert)-[:FLAGS]->(t:Transaction {txid:$n,case_id:$c}) RETURN al.alert_id AS aid, properties(al) AS ap",
                        n=node_id, c=case_id,
                    ):
                        _alert(r["aid"], dict(r["ap"] or {}))
                        if r["aid"]:
                            edges.append({"id": f"f_{r['aid']}", "source": r["aid"], "target": node_id, "type": "FLAGS"})

                elif node_type == "Address":
                    row = s.run("MATCH (a:Address {value:$n}) RETURN properties(a) AS p", n=node_id).single()
                    if row:
                        _addr(node_id, dict(row["p"]))

                    for r in s.run(
                        "MATCH (a:Address {value:$n})-[rel:SPENDS]->(t:Transaction {case_id:$c}) RETURN t.txid AS tid, properties(t) AS tp, rel.amount_sats AS amt",
                        n=node_id, c=case_id,
                    ):
                        _tx(r["tid"], dict(r["tp"] or {}))
                        if r["tid"]:
                            edges.append({"id": f"s_{node_id}_{r['tid']}", "source": node_id, "target": r["tid"],
                                          "type": "SPENDS", "amount_sats": r["amt"], "amount_btc": _sats_to_btc(r["amt"])})

                    for r in s.run(
                        "MATCH (t:Transaction {case_id:$c})-[rel:PAYS_TO]->(a:Address {value:$n}) RETURN t.txid AS tid, properties(t) AS tp, rel.amount_sats AS amt",
                        n=node_id, c=case_id,
                    ):
                        _tx(r["tid"], dict(r["tp"] or {}))
                        if r["tid"]:
                            edges.append({"id": f"p_{r['tid']}_{node_id}", "source": r["tid"], "target": node_id,
                                          "type": "PAYS_TO", "amount_sats": r["amt"], "amount_btc": _sats_to_btc(r["amt"])})

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    node_list = list(nodes.values())
    total = len(node_list)
    capped = total > max_nodes
    return {
        "nodes": node_list[:max_nodes],
        "edges": edges,
        "total_nodes": total,
        "capped": capped,
        "cap": max_nodes,
    }


# ── Alerts list ────────────────────────────────────────────────

@app.get("/alerts", tags=["Alerts"])
def list_alerts(case_id: str = DEFAULT_CASE_ID, type_filter: Optional[str] = None):
    """Return all persisted Alert nodes for a case, deduplicated, with flagged_txids and risk_hits."""
    base = """
    MATCH (al:Alert)-[:FLAGS]->(t:Transaction)
    WHERE al.case_id = $c
    """
    filt = "AND al.type = $tf " if type_filter else ""
    q = base + filt + """
    WITH al, collect(DISTINCT t.txid) AS flagged_txids
    OPTIONAL MATCH (al)-[:FLAGS]->(t:Transaction)-[:SPENDS|PAYS_TO]-(a:Address)
    WHERE a.risk_score IS NOT NULL
    WITH al, flagged_txids,
         collect(DISTINCT CASE WHEN a IS NOT NULL THEN {
             entity: coalesce(a.entity_name, 'Known Seed'),
             risk: a.risk_score,
             address: a.value
         } END) AS raw_risk_hits
    RETURN al.alert_id AS alert_id, al.type AS type,
           al.confidence AS confidence, al.txid AS txid,
           flagged_txids, al.evidence_json AS ev_json,
           raw_risk_hits,
           toString(al.updated_at) AS updated_at
    ORDER BY al.confidence DESC
    """
    try:
        alerts = []
        with _driver() as driver:
            with driver.session() as s:
                params = {"c": case_id}
                if type_filter:
                    params["tf"] = type_filter
                for r in s.run(q, **params):
                    ev = {}
                    if r["ev_json"]:
                        try:
                            ev = json.loads(r["ev_json"])
                        except Exception:
                            pass

                    # Clean risk_hits list
                    raw_hits = r["raw_risk_hits"] or []
                    risk_hits = [h for h in raw_hits if h and h.get("risk") is not None]

                    # Compute total transaction value / exposure from evidence
                    total_sats = 0
                    if r["type"] == "coinjoin_like":
                        outs = ev.get("output_amounts_sats") or []
                        total_sats = sum(outs)
                    elif r["type"] == "peeling_chain":
                        seq = ev.get("value_sequence_sats") or []
                        total_sats = seq[0] if seq else 0

                    flagged_txids = r["flagged_txids"] or []
                    primary_txid = r["txid"] or (flagged_txids[0] if flagged_txids else None)

                    alerts.append({
                        "alert_id": r["alert_id"],
                        "type": r["type"],
                        "confidence": r["confidence"],
                        "confidence_pct": f"{(r['confidence'] or 0) * 100:.1f}%",
                        "txid": primary_txid,
                        "flagged_txids": flagged_txids,
                        "evidence": ev,
                        "risk_hits": risk_hits,
                        "total_sats": total_sats,
                        "total_btc": _sats_to_btc(total_sats),
                        "updated_at": r["updated_at"],
                    })
        return {"case_id": case_id, "alert_count": len(alerts), "alerts": alerts}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Ingestion ──────────────────────────────────────────────────

@app.get("/ingest/files", tags=["Ingest"])
def list_data_files():
    if not DATA_DIR.exists():
        return {"files": []}
    files = [
        {"name": f.name, "size_bytes": f.stat().st_size, "format": f.suffix.lstrip(".")}
        for f in sorted(DATA_DIR.iterdir())
        if f.suffix.lower() in (".csv", ".json", ".xml") and "label" not in f.name.lower()
    ]
    return {"data_dir": str(DATA_DIR), "files": files}


@app.post("/ingest/upload", tags=["Ingest"])
async def ingest_upload(file: UploadFile = File(...), case_id: str = Form(DEFAULT_CASE_ID)):
    suffix = Path(file.filename).suffix.lower()
    if suffix not in (".csv", ".json", ".xml"):
        raise HTTPException(status_code=400, detail=f"Unsupported format '{suffix}'")
    content = await file.read()
    parsers = {".csv": parse_csv_file, ".json": parse_json_file, ".xml": parse_xml_file}
    try:
        parsed = parsers[suffix](content, file.filename)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    validated = validate_batch(parsed)
    try:
        with _driver() as driver:
            ensure_constraints(driver)
            cands = [r.data.txid for r in validated if r.status == "accepted" and r.data]
            existing = get_existing_txids(driver, case_id, cands)
            deduped = dedup_batch(validated, existing)
            final = load_batch(driver, case_id, deduped)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    accepted   = [r for r in final if r.status == "accepted"]
    invalid    = [r for r in final if r.status == "rejected_invalid"]
    duplicate  = [r for r in final if r.status == "rejected_duplicate"]
    return {
        "import_id": f"imp_{uuid.uuid4().hex[:8]}",
        "case_id": case_id, "file": file.filename,
        "total_records": len(final),
        "accepted_count": len(accepted),
        "rejected_invalid_count": len(invalid),
        "rejected_duplicate_count": len(duplicate),
        "results": [
            {"row_ref": r.row_ref, "status": r.status,
             "txid": r.data.txid if r.data else None, "errors": r.errors}
            for r in final
        ],
    }


@app.post("/ingest/run-all", tags=["Ingest"])
def ingest_run_all(case_id: str = DEFAULT_CASE_ID):
    if not DATA_DIR.exists():
        raise HTTPException(status_code=404, detail=f"DATA_DIR not found: {DATA_DIR}")
    files = [
        f for f in sorted(DATA_DIR.iterdir())
        if f.suffix.lower() in (".csv", ".json", ".xml") and "label" not in f.name.lower()
    ]
    if not files:
        raise HTTPException(status_code=404, detail="No transaction files found")
    reports = []
    try:
        with _driver() as driver:
            ensure_constraints(driver)
            for fp in files:
                report = ingest_file(driver, fp, case_id)
                reports.append({
                    "file": fp.name, "import_id": report.import_id, "case_id": report.case_id,
                    "total_records": report.total_records, "accepted_count": report.accepted_count,
                    "rejected_invalid_count": report.rejected_invalid_count,
                    "rejected_duplicate_count": report.rejected_duplicate_count,
                })
            labels_path = DATA_DIR / "seed_labels.json"
            labels_tagged = load_seed_labels(driver, labels_path) if labels_path.exists() else 0
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return {"case_id": case_id, "files_processed": len(reports), "labels_tagged": labels_tagged, "reports": reports}


# ── Detection ──────────────────────────────────────────────────

@app.get("/detect/coinjoin", tags=["Detect"])
def detect_coinjoin_scan(case_id: str = DEFAULT_CASE_ID, min_confidence: float = 0.5):
    if not (0.0 <= min_confidence <= 1.0):
        raise HTTPException(status_code=400, detail="min_confidence must be 0–1")
    try:
        with _driver() as driver:
            alerts = detect_coinjoin(driver, case_id=case_id, min_confidence=min_confidence)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return {
        "case_id": case_id, "min_confidence": min_confidence, "alert_count": len(alerts),
        "alerts": [
            {
                "alert_id": a["alert_id"], "type": a["type"], "txid": a["txid"],
                "confidence": a["confidence"],
                "confidence_pct": f"{a['confidence'] * 100:.1f}%",
                "input_count": a["evidence"]["input_count"],
                "output_count": a["evidence"]["output_count"],
                "output_amounts_btc": [_sats_to_btc(v) for v in a["evidence"]["output_amounts_sats"]],
            }
            for a in alerts
        ],
    }


@app.post("/detect/coinjoin/write", tags=["Detect"])
def detect_coinjoin_write(case_id: str = DEFAULT_CASE_ID, min_confidence: float = 0.5):
    if not (0.0 <= min_confidence <= 1.0):
        raise HTTPException(status_code=400, detail="min_confidence must be 0–1")
    try:
        with _driver() as driver:
            alerts = detect_coinjoin(driver, case_id=case_id, min_confidence=min_confidence)
            if alerts:
                write_coinjoin_alerts(driver, alerts, case_id=case_id)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return {
        "case_id": case_id, "alerts_written": len(alerts),
        "message": f"Wrote {len(alerts)} alert(s) to Neo4j" if alerts else "No alerts above threshold",
    }


@app.get("/detect/peeling-chain", tags=["Detect"])
def detect_peeling_scan(case_id: str = DEFAULT_CASE_ID, min_confidence: float = 0.5):
    """Run the peeling-chain detector and return scored alerts (not persisted)."""
    if not (0.0 <= min_confidence <= 1.0):
        raise HTTPException(status_code=400, detail="min_confidence must be 0–1")
    try:
        with _driver() as driver:
            alerts = detect_peeling_chain(driver, case_id=case_id, min_confidence=min_confidence)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return {
        "case_id": case_id, "min_confidence": min_confidence, "alert_count": len(alerts),
        "alerts": [
            {
                "alert_id": a["alert_id"], "type": a["type"], "txid": a["txid"],
                "confidence": a["confidence"],
                "confidence_pct": f"{a['confidence'] * 100:.1f}%",
                "chain_length": len(a["path"]),
                "path": a["path"],
                "value_sequence_btc": [_sats_to_btc(v) for v in a["evidence"]["value_sequence_sats"]],
            }
            for a in alerts
        ],
    }


@app.post("/detect/peeling-chain/write", tags=["Detect"])
def detect_peeling_write(case_id: str = DEFAULT_CASE_ID, min_confidence: float = 0.5):
    """Run peeling-chain detector and persist Alert nodes to Neo4j."""
    if not (0.0 <= min_confidence <= 1.0):
        raise HTTPException(status_code=400, detail="min_confidence must be 0–1")
    try:
        with _driver() as driver:
            alerts = detect_peeling_chain(driver, case_id=case_id, min_confidence=min_confidence)
            if alerts:
                write_peeling_alerts(driver, alerts, case_id=case_id)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return {
        "case_id": case_id, "alerts_written": len(alerts),
        "message": f"Wrote {len(alerts)} alert(s) to Neo4j" if alerts else "No alerts above threshold",
    }


# ── Assistant (LangGraph agent) ────────────────────────────────

# Pre-compile the agent graph once — reused across all requests.
# Driver is created per-request inside the endpoint (since it needs
# verify_connectivity each time), but the graph structure is static.
_compiled_agent = None

# In-memory session store: session_id -> ConversationState
# Lives for the lifetime of the uvicorn process. Tab refresh generates a new
# session_id (frontend), so stale context clears naturally on reload.
_SESSION_STORE: dict[str, ConversationState] = {}


class ChatRequest:
    """Simple body model for the chat endpoint."""
    pass


from pydantic import BaseModel as _BM

class _ChatBody(_BM):
    message: str
    case_id: str = DEFAULT_CASE_ID
    session_id: str = ""   # empty = anonymous (no memory), same behaviour as before


@app.post("/assistant/chat", tags=["Assistant"])
def assistant_chat(body: _ChatBody):
    """Send a message to the LangGraph agent. Returns the agent's reply,
    the tool it called (if any), and the raw tool result data.
    Pass a stable `session_id` (UUID) per browser tab to enable
    cross-turn memory (pronoun resolution for follow-ups)."""
    global _compiled_agent
    try:
        driver = _driver()
        if _compiled_agent is None:
            _compiled_agent = build_agent(driver)

        # Load session context (empty for anonymous/fresh sessions)
        sid = body.session_id.strip()
        session_ctx = _SESSION_STORE.get(sid) if sid else None

        result, updated_ctx = run_agent(
            driver,
            body.case_id,
            body.message,
            compiled_graph=_compiled_agent,
            session_context=session_ctx,
        )

        # Persist updated state back to session store
        if sid and (getattr(updated_ctx, "last_entity_id", None) or any(updated_ctx.values())):
            _SESSION_STORE[sid] = updated_ctx

        driver.close()
        return {
            "reply": result.reply,
            "tool":  result.tool,
            "data":  result.data,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Static — mount last so API routes take priority ────────────
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
