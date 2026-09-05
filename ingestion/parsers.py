from __future__ import annotations

import csv
import io
import json
import xml.etree.ElementTree as ET

from .schemas import RawRecord

# Each parser returns a list of (record_or_None, row_ref, errors).
# record is None when the row/element itself is malformed — this lets
# one bad row get rejected without aborting the rest of the file.


def _row_ref(source_file: str, ref: str) -> str:
    return f"{source_file}:{ref}"


def parse_csv_file(content: bytes, source_file: str):
    results = []
    text = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))

    for i, row in enumerate(reader, start=1):
        ref = _row_ref(source_file, f"row_{i}")
        try:
            in_addrs = row["input_addresses"].split("|")
            in_amts = [float(a) for a in row["input_amounts"].split("|")]
            out_addrs = row["output_addresses"].split("|")
            out_amts = [float(a) for a in row["output_amounts"].split("|")]

            errors = []
            if len(in_addrs) != len(in_amts):
                errors.append("input_addresses/input_amounts count mismatch")
            if len(out_addrs) != len(out_amts):
                errors.append("output_addresses/output_amounts count mismatch")
            if errors:
                results.append((None, ref, errors))
                continue

            record = RawRecord(
                txid=row["txid"],
                timestamp=row["timestamp"],
                src_ip=row["src_ip"],
                dst_ip=row["dst_ip"],
                src_port=int(row["src_port"]),
                dst_port=int(row["dst_port"]),
                inputs=[{"address": a, "amount": amt} for a, amt in zip(in_addrs, in_amts)],
                outputs=[{"address": a, "amount": amt} for a, amt in zip(out_addrs, out_amts)],
                geo_country=row["geo_country"],
                asn=int(row["asn"]),
                source_format="csv",
                source_file=source_file,
                source_row=f"row_{i}",
            )
            results.append((record, ref, []))
        except (KeyError, ValueError) as exc:
            results.append((None, ref, [f"malformed row: {exc}"]))

    return results


def parse_json_file(content: bytes, source_file: str):
    results = []
    try:
        records = json.loads(content)
    except json.JSONDecodeError as exc:
        # Whole-file parse failure is the one case where fail-fast at
        # file level is correct — there's no per-record structure to save.
        raise ValueError(f"{source_file}: invalid JSON — {exc}") from exc

    if not isinstance(records, list):
        raise ValueError(f"{source_file}: expected a JSON array of transactions")

    for i, rec in enumerate(records):
        ref = _row_ref(source_file, f"idx_{i}")
        try:
            in_addrs = rec["input_addresses"]
            in_amts = rec["input_amounts"]
            out_addrs = rec["output_addresses"]
            out_amts = rec["output_amounts"]

            errors = []
            if len(in_addrs) != len(in_amts):
                errors.append("input_addresses/input_amounts count mismatch")
            if len(out_addrs) != len(out_amts):
                errors.append("output_addresses/output_amounts count mismatch")
            if errors:
                results.append((None, ref, errors))
                continue

            record = RawRecord(
                txid=rec["txid"],
                timestamp=rec["timestamp"],
                src_ip=rec["src_ip"],
                dst_ip=rec["dst_ip"],
                src_port=rec["src_port"],
                dst_port=rec["dst_port"],
                inputs=[{"address": a, "amount": amt} for a, amt in zip(in_addrs, in_amts)],
                outputs=[{"address": a, "amount": amt} for a, amt in zip(out_addrs, out_amts)],
                geo_country=rec["geo_country"],
                asn=rec["asn"],
                source_format="json",
                source_file=source_file,
                source_row=f"idx_{i}",
            )
            results.append((record, ref, []))
        except (KeyError, TypeError, ValueError) as exc:
            results.append((None, ref, [f"malformed record: {exc}"]))

    return results


def parse_xml_file(content: bytes, source_file: str):
    """<transactions><transaction txid="..."> with <address amount="">
    children — amount is already paired with address, no zip() needed."""
    results = []
    try:
        root = ET.fromstring(content)
    except ET.ParseError as exc:
        raise ValueError(f"{source_file}: invalid XML — {exc}") from exc

    for i, tx in enumerate(root.findall("transaction")):
        ref = _row_ref(source_file, f"row_{i}")
        try:
            def _pairs(tag: str):
                container = tx.find(tag)
                if container is None:
                    raise KeyError(tag)
                return [
                    {"address": el.text.strip(), "amount": float(el.attrib["amount"])}
                    for el in container.findall("address")
                ]

            record = RawRecord(
                txid=tx.attrib["txid"],
                timestamp=tx.findtext("timestamp"),
                src_ip=tx.findtext("src_ip"),
                dst_ip=tx.findtext("dst_ip"),
                src_port=int(tx.findtext("src_port")),
                dst_port=int(tx.findtext("dst_port")),
                inputs=_pairs("input_addresses"),
                outputs=_pairs("output_addresses"),
                geo_country=tx.findtext("geo_country"),
                asn=int(tx.findtext("asn")),
                source_format="xml",
                source_file=source_file,
                source_row=f"row_{i}",
            )
            results.append((record, ref, []))
        except (KeyError, TypeError, ValueError, AttributeError) as exc:
            results.append((None, ref, [f"malformed element: {exc}"]))

    return results