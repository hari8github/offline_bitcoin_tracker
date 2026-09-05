"""
Graph Ingestion & Pipeline Runner for Bitcoin Forensic Graph.
Coordinates parsing from `ingestion`, validation, deduplication, and loading into Neo4j.
"""

from __future__ import annotations

import argparse
import json
import sys
import uuid
from pathlib import Path
from typing import Optional

# Ensure project root is in sys.path when executed directly as a script
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from neo4j import Driver

from config import DATA_DIR, DEFAULT_CASE_ID, get_neo4j_driver
from graph.dedup import dedup_batch, get_existing_txids
from graph.loader import ensure_constraints, load_batch
from ingestion.parsers import parse_csv_file, parse_json_file, parse_xml_file
from ingestion.schemas import ImportReport, IngestResult
from ingestion.validate import validate_batch


def parse_by_extension(content: bytes, file_name: str) -> list:
    """Select appropriate parser based on the file extension."""
    suffix = Path(file_name).suffix.lower()
    if suffix == ".csv":
        return parse_csv_file(content, file_name)
    elif suffix == ".json":
        return parse_json_file(content, file_name)
    elif suffix == ".xml":
        return parse_xml_file(content, file_name)
    else:
        raise ValueError(f"Unsupported file format: {suffix} (supported: .csv, .json, .xml)")


def ingest_file(driver: Driver, file_path: Path | str, case_id: str = DEFAULT_CASE_ID) -> ImportReport:
    """Run full ingestion pipeline (Parse -> Validate -> Dedup -> Neo4j Load) on a single file."""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    import_id = f"imp_{uuid.uuid4().hex[:8]}"
    content = path.read_bytes()

    # 1. Parse raw bytes
    parsed_records = parse_by_extension(content, path.name)

    # 2. Validate and convert amounts to integer satoshis
    validated_results: list[IngestResult] = validate_batch(parsed_records)

    # 3. Query existing txids from Neo4j for this case & deduplicate
    candidate_txids = [
        r.data.txid for r in validated_results if r.status == "accepted" and r.data is not None
    ]
    existing_txids = get_existing_txids(driver, case_id, candidate_txids)
    deduped_results = dedup_batch(validated_results, existing_txids)

    # 4. Load accepted transactions into Neo4j (UTXO bipartite graph)
    final_results = load_batch(driver, case_id, deduped_results)

    # 5. Build report
    accepted_count = sum(1 for r in final_results if r.status == "accepted")
    invalid_count = sum(1 for r in final_results if r.status == "rejected_invalid")
    duplicate_count = sum(1 for r in final_results if r.status == "rejected_duplicate")

    return ImportReport(
        case_id=case_id,
        import_id=import_id,
        total_records=len(final_results),
        accepted_count=accepted_count,
        rejected_invalid_count=invalid_count,
        rejected_duplicate_count=duplicate_count,
        results=final_results,
    )


def load_seed_labels(driver: Driver, labels_file: Path | str) -> int:
    """Load forensic risk labels and entity info onto Address nodes in Neo4j."""
    path = Path(labels_file)
    if not path.exists():
        return 0

    with open(path, "r", encoding="utf-8") as f:
        labels = json.load(f)

    query = """
    UNWIND $labels AS l
    MERGE (a:Address {value: l.address})
    SET a.entity_name = l.entity_name,
        a.entity_type = l.entity_type,
        a.risk_score = l.risk_score,
        a.label_confidence = l.label_confidence,
        a.source = l.source,
        a.first_flagged_txid = l.first_flagged_txid
    RETURN count(a) AS tagged_count
    """
    with driver.session() as session:
        result = session.run(query, labels=labels)
        return result.single()["tagged_count"]


def run_pipeline(
    case_id: str = DEFAULT_CASE_ID,
    target_path: Optional[str | Path] = None,
    load_labels: bool = True,
) -> list[ImportReport]:
    """Execute the ingestion pipeline across specified files or all files in DATA_DIR."""
    reports: list[ImportReport] = []

    print("=" * 70)
    print("🚀 BITCOIN GRAPH INGESTION PIPELINE")
    print(f"🎯 Target Case ID: {case_id}")
    print("=" * 70)

    with get_neo4j_driver() as driver:
        # Step 1: Neo4j connectivity & DB-level constraints
        driver.verify_connectivity()
        print(" Connected to Neo4j.")
        ensure_constraints(driver)
        print(" Schema constraints verified (txid + case_id unique).")

        # Step 2: Identify files to ingest
        files_to_process: list[Path] = []
        if target_path:
            p = Path(target_path)
            if p.is_file():
                files_to_process.append(p)
            elif p.is_dir():
                for ext in ("*.csv", "*.json", "*.xml"):
                    files_to_process.extend(p.glob(ext))
        else:
            if DATA_DIR.exists():
                for ext in ("*.csv", "*.json", "*.xml"):
                    for file in DATA_DIR.glob(ext):
                        if "label" not in file.name.lower():
                            files_to_process.append(file)

        if not files_to_process:
            print("⚠️ No transaction files found to ingest.")
            return reports

        # Step 3: Parse, validate, dedup, and load each file
        print(f"\n📁 Found {len(files_to_process)} transaction file(s)...")
        for file in sorted(files_to_process):
            print(f"\n▶ Ingesting: {file.name}")
            report = ingest_file(driver, file, case_id)
            reports.append(report)

            print(f"  ✓ Processed: {report.total_records} rows")
            print(f"  ✓ Accepted & Loaded:  {report.accepted_count}")
            print(f"  ✗ Rejected (Invalid):   {report.rejected_invalid_count}")
            print(f"  ✗ Rejected (Duplicate): {report.rejected_duplicate_count}")

        # Step 4: Seed labels
        if load_labels:
            labels_path = DATA_DIR / "seed_labels.json"
            if labels_path.exists():
                count = load_seed_labels(driver, labels_path)
                print(f"\n🏷️  Tagged {count} illicit entity address labels from {labels_path.name}")

    print("\n" + "=" * 70)
    total_acc = sum(r.accepted_count for r in reports)
    total_dup = sum(r.rejected_duplicate_count for r in reports)
    total_inv = sum(r.rejected_invalid_count for r in reports)
    print(f"✅ INGESTION FINISHED: {total_acc} Total Transactions Loaded in Neo4j")
    if total_dup or total_inv:
        print(f"⚠️  Duplicates Filtered: {total_dup} | Invalid Rows Skipped: {total_inv}")
    print("=" * 70)

    return reports


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest Bitcoin transactions into Neo4j graph database.")
    parser.add_argument("--case-id", default=DEFAULT_CASE_ID, help="Case identifier (default: from .env)")
    parser.add_argument("--file", default=None, help="Path to specific transaction file (.csv, .json, .xml)")
    parser.add_argument("--no-labels", action="store_true", help="Skip loading seed labels")

    args = parser.parse_args()
    run_pipeline(case_id=args.case_id, target_path=args.file, load_labels=not args.no_labels)
