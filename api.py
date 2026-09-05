"""
Bitcoin Forensics – FastAPI backend (v2)
Serves the investigator console and exposes REST endpoints for
dashboard analytics, graph exploration, ingestion, and detection.
"""

from __future__ import annotations

import json
import uuid
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
    """Return all persisted Alert nodes for a case, sorted by confidence desc."""
    base = """
    MATCH (al:Alert)-[:FLAGS]->(t:Transaction)
    WHERE al.case_id = $c
    """
    filt = "AND al.type = $tf " if type_filter else ""
    q = base + filt + """
    RETURN al.alert_id AS alert_id, al.type AS type,
           al.confidence AS confidence, al.txid AS txid,
           al.evidence_json AS ev_json,
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
                    alerts.append({
                        "alert_id": r["alert_id"],
                        "type": r["type"],
                        "confidence": r["confidence"],
                        "confidence_pct": f"{(r['confidence'] or 0) * 100:.1f}%",
                        "txid": r["txid"],
                        "evidence": ev,
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


class ChatRequest:
    """Simple body model for the chat endpoint."""
    pass


from pydantic import BaseModel as _BM

class _ChatBody(_BM):
    message: str
    case_id: str = DEFAULT_CASE_ID


@app.post("/assistant/chat", tags=["Assistant"])
def assistant_chat(body: _ChatBody):
    """Send a message to the LangGraph agent. Returns the agent's reply,
    the tool it called (if any), and the raw tool result data."""
    global _compiled_agent
    try:
        driver = _driver()
        if _compiled_agent is None:
            _compiled_agent = build_agent(driver)
        result = run_agent(driver, body.case_id, body.message, compiled_graph=_compiled_agent)
        driver.close()
        return {
            "reply": result.reply,
            "tool": result.tool,
            "data": result.data,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Static — mount last so API routes take priority ────────────
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
