from __future__ import annotations

import json
import sys
from config import get_neo4j_driver, DEFAULT_CASE_ID
from detectors.coinjoin import detect_coinjoin, write_alerts


def main():
    print("=" * 60)
    print("COINJOIN DETECTOR TEST")
    print(f"Target Case ID: {DEFAULT_CASE_ID}")
    print("=" * 60)

    with get_neo4j_driver() as driver:
        # 1. Check Neo4j Connectivity
        driver.verify_connectivity()
        print("[+] Connected to Neo4j successfully.")

        # 2. Run CoinJoin Detector
        alerts = detect_coinjoin(driver, case_id=DEFAULT_CASE_ID, min_confidence=0.5)

        print(f"\n[i] Detected {len(alerts)} CoinJoin-like Transaction(s):")
        for i, a in enumerate(alerts, 1):
            print(f"\n[{i}] Alert ID: {a['alert_id']}")
            print(f"    TXID:       {a['txid']}")
            print(f"    Type:       {a['type']}")
            print(f"    Confidence: {a['confidence'] * 100:.1f}%")
            print(f"    Evidence:   {json.dumps(a['evidence'], indent=8)}")

        # 3. Write alerts to Neo4j
        if alerts:
            write_alerts(driver, alerts, case_id=DEFAULT_CASE_ID)
            print(f"\n[+] Successfully wrote {len(alerts)} :Alert node(s) linked via [:FLAGS] in Neo4j.")
        else:
            print("\n[-] No CoinJoin transactions detected above threshold for this case.")

        print("=" * 60)


if __name__ == "__main__":
    main()