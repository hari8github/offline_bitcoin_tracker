from __future__ import annotations

from pydantic import ValidationError

from .schemas import AddressAmount, IngestResult, NormalizedTx, RawRecord, btc_to_sats


def validate_record(raw: RawRecord, row_ref: str) -> IngestResult:
    """Validate + normalize one RawRecord into a NormalizedTx.
    Never raises — every failure becomes a rejected IngestResult."""
    try:
        normalized = NormalizedTx(
            txid=raw.txid,
            timestamp=raw.timestamp,
            src_ip=raw.src_ip,
            dst_ip=raw.dst_ip,
            src_port=raw.src_port,
            dst_port=raw.dst_port,
            inputs=[
                AddressAmount(address=i["address"], amount_sats=btc_to_sats(i["amount"]))
                for i in raw.inputs
            ],
            outputs=[
                AddressAmount(address=o["address"], amount_sats=btc_to_sats(o["amount"]))
                for o in raw.outputs
            ],
            geo_country=raw.geo_country,
            asn=raw.asn,
            source_format=raw.source_format,
            source_file=raw.source_file,
            source_row=raw.source_row,
        )
        return IngestResult(row_ref=row_ref, status="accepted", data=normalized)
    except ValidationError as exc:
        errors = [f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in exc.errors()]
        return IngestResult(row_ref=row_ref, status="rejected_invalid", errors=errors)


def validate_batch(parsed: list) -> list[IngestResult]:
    """Run validate_record over one file's parser output. parsed is the
    list of (record_or_None, row_ref, parse_errors) a parser returns."""
    results: list[IngestResult] = []
    for record, ref, parse_errors in parsed:
        if record is None:
            results.append(
                IngestResult(row_ref=ref, status="rejected_invalid", errors=parse_errors)
            )
            continue
        results.append(validate_record(record, ref))
    return results