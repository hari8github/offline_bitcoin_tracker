from __future__ import annotations

from ingestion.schemas import IngestResult


def dedup_batch(results: list[IngestResult], existing_txids: set[str]) -> list[IngestResult]:
    """Apply duplicate detection in upload order — first occurrence of a
    txid wins, later ones (in this batch or already in the DB) are
    marked rejected_duplicate.

    existing_txids: txids already in Neo4j for this case_id — fetch this
    with get_existing_txids() once per import, not once per record.
    """
    seen_in_batch: set[str] = set()
    deduped: list[IngestResult] = []

    for result in results:
        if result.status != "accepted":
            deduped.append(result)  # already rejected upstream, nothing to dedup
            continue

        txid = result.data.txid
        if txid in existing_txids or txid in seen_in_batch:
            deduped.append(
                IngestResult(
                    row_ref=result.row_ref,
                    status="rejected_duplicate",
                    data=result.data,
                    errors=[f"duplicate txid within case: {txid}"],
                )
            )
            continue

        seen_in_batch.add(txid)
        deduped.append(result)

    return deduped


def get_existing_txids(driver, case_id: str, candidate_txids: list[str]) -> set[str]:
    """One batched query for the whole import — not one query per row."""
    query = """
    MATCH (t:Transaction {case_id: $case_id})
    WHERE t.txid IN $txids
    RETURN t.txid AS txid
    """
    with driver.session() as session:
        records = session.run(query, case_id=case_id, txids=candidate_txids)
        return {r["txid"] for r in records}