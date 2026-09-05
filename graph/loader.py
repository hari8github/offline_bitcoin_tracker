from __future__ import annotations

from neo4j.exceptions import ConstraintError

from ingestion.schemas import IngestResult, NormalizedTx


def ensure_constraints(driver) -> None:
    """Run once at startup. (txid, case_id) uniqueness is the DB-level
    backstop behind the app-level dedup check in dedup.py."""
    with driver.session() as session:
        session.run(
            """
            CREATE CONSTRAINT tx_case_unique IF NOT EXISTS
            FOR (t:Transaction) REQUIRE (t.txid, t.case_id) IS UNIQUE
            """
        )


_LOAD_TX_QUERY = """
MERGE (t:Transaction {txid: $txid, case_id: $case_id})
SET t.timestamp = datetime($timestamp),
    t.src_ip = $src_ip, t.dst_ip = $dst_ip,
    t.src_port = $src_port, t.dst_port = $dst_port,
    t.geo_country = $geo_country, t.asn = $asn,
    t.total_input_sats = $total_input_sats,
    t.total_output_sats = $total_output_sats,
    t.implied_fee_sats = $implied_fee_sats,
    t.source_format = $source_format, t.source_file = $source_file,
    t.source_row = $source_row

WITH t
UNWIND $inputs AS inp
MERGE (a:Address {value: inp.address})
MERGE (a)-[:SPENDS {amount_sats: inp.amount_sats}]->(t)

WITH t
UNWIND $outputs AS outp
MERGE (b:Address {value: outp.address})
MERGE (t)-[:PAYS_TO {amount_sats: outp.amount_sats}]->(b)
"""


def load_transaction(driver, case_id: str, tx: NormalizedTx) -> None:
    params = {
        "case_id": case_id,
        "txid": tx.txid,
        "timestamp": tx.timestamp.isoformat(),
        "src_ip": tx.src_ip, "dst_ip": tx.dst_ip,
        "src_port": tx.src_port, "dst_port": tx.dst_port,
        "geo_country": tx.geo_country, "asn": tx.asn,
        "total_input_sats": tx.total_input_sats,
        "total_output_sats": tx.total_output_sats,
        "implied_fee_sats": tx.implied_fee_sats,
        "source_format": tx.source_format, "source_file": tx.source_file,
        "source_row": tx.source_row,
        "inputs": [{"address": i.address, "amount_sats": i.amount_sats} for i in tx.inputs],
        "outputs": [{"address": o.address, "amount_sats": o.amount_sats} for o in tx.outputs],
    }
    with driver.session() as session:
        session.run(_LOAD_TX_QUERY, **params)


def load_batch(driver, case_id: str, results: list[IngestResult]) -> list[IngestResult]:
    """Insert all accepted results. A ConstraintError here means the
    app-level dedup pre-filter missed something (e.g. a race between
    two concurrent imports) — caught and downgraded to
    rejected_duplicate instead of raising a 500."""
    final: list[IngestResult] = []
    for result in results:
        if result.status != "accepted":
            final.append(result)
            continue
        try:
            load_transaction(driver, case_id, result.data)
            final.append(result)
        except ConstraintError:
            final.append(
                IngestResult(
                    row_ref=result.row_ref,
                    status="rejected_duplicate",
                    data=result.data,
                    errors=[f"duplicate txid caught at DB constraint: {result.data.txid}"],
                )
            )
    return final