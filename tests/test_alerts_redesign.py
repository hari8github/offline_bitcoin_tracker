from __future__ import annotations

import json
import unittest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from api import app, DEFAULT_CASE_ID
from detectors.peeling_chain import _WRITE_ALERT_QUERY, write_alerts


class MockResult:
    def __init__(self, data=None):
        self._data = data if data is not None else []

    def single(self):
        if isinstance(self._data, list):
            return self._data[0] if self._data else None
        return self._data

    def __iter__(self):
        if isinstance(self._data, list):
            return iter(self._data)
        return iter([self._data])


class MockSession:
    def __init__(self, handler):
        self.handler = handler

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

    def run(self, query, **params):
        return self.handler(query, params)


class MockDriverCtx:
    def __init__(self, handler):
        self.handler = handler

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

    def session(self):
        return MockSession(self.handler)


class TestAlertsRedesign(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_peeling_chain_write_query_has_txid(self):
        """Ensure peeling chain query assigns al.txid = $txid."""
        self.assertIn("al.txid = $txid", _WRITE_ALERT_QUERY)

    @patch("detectors.peeling_chain.clear_peeling_chain_alerts")
    @patch("detectors.peeling_chain.ensure_alert_constraints")
    def test_peeling_chain_write_alerts_passes_txid(self, mock_ensure, mock_clear):
        """Ensure write_alerts passes txid parameter to session.run."""
        recorded_calls = []

        def handler(query, params):
            recorded_calls.append(params)
            return MockResult([])

        mock_driver = MockDriverCtx(handler)
        alerts = [
            {
                "alert_id": "alert_peel_1",
                "type": "peeling_chain",
                "txid": "tx_start_001",
                "path": ["tx_start_001", "tx_hop_002", "tx_hop_003"],
                "case_id": "CASE_TEST",
                "confidence": 0.95,
                "evidence": {"path": ["tx_start_001", "tx_hop_002", "tx_hop_003"]},
            }
        ]

        write_alerts(mock_driver, alerts, case_id="CASE_TEST")
        self.assertEqual(len(recorded_calls), 1)
        self.assertEqual(recorded_calls[0]["txid"], "tx_start_001")
        self.assertEqual(recorded_calls[0]["alert_id"], "alert_peel_1")

    @patch("api._driver")
    def test_list_alerts_deduplication_and_risk_hits(self, mock_driver):
        """Ensure list_alerts groups multi-hop flags into a single alert with flagged_txids and risk_hits."""
        cypher_rows = [
            {
                "alert_id": "alert_peel_100",
                "type": "peeling_chain",
                "confidence": 0.92,
                "txid": "tx_start_100",
                "flagged_txids": ["tx_start_100", "tx_hop_101", "tx_hop_102", "tx_hop_103"],
                "ev_json": json.dumps({
                    "path": ["tx_start_100", "tx_hop_101", "tx_hop_102", "tx_hop_103"],
                    "value_sequence_sats": [500000000, 400000000, 300000000, 200000000],
                }),
                "raw_risk_hits": [
                    {
                        "entity": "Darknet Market",
                        "risk": 0.9,
                        "address": "bc1qdarknet",
                    }
                ],
                "updated_at": "2026-03-01T14:30:00Z",
            },
            {
                "alert_id": "alert_cj_200",
                "type": "coinjoin_like",
                "confidence": 1.0,
                "txid": "tx_cj_200",
                "flagged_txids": ["tx_cj_200"],
                "ev_json": json.dumps({
                    "input_count": 5,
                    "output_count": 5,
                    "output_amounts_sats": [25500000] * 5,
                }),
                "raw_risk_hits": [],
                "updated_at": "2026-03-01T15:00:00Z",
            }
        ]

        def handler(query, params):
            return MockResult(cypher_rows)

        mock_driver.return_value = MockDriverCtx(handler)

        res = self.client.get(f"/alerts?case_id={DEFAULT_CASE_ID}")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["case_id"], DEFAULT_CASE_ID)
        self.assertEqual(data["alert_count"], 2)
        alerts = data["alerts"]

        # First alert: Peeling chain with 4 hops
        peel = alerts[0]
        self.assertEqual(peel["alert_id"], "alert_peel_100")
        self.assertEqual(peel["txid"], "tx_start_100")
        self.assertEqual(len(peel["flagged_txids"]), 4)
        self.assertEqual(len(peel["risk_hits"]), 1)
        self.assertEqual(peel["risk_hits"][0]["entity"], "Darknet Market")
        self.assertEqual(peel["risk_hits"][0]["risk"], 0.9)
        self.assertEqual(peel["total_btc"], 5.0)  # 500000000 sats = 5 BTC starting balance

        # Second alert: CoinJoin
        cj = alerts[1]
        self.assertEqual(cj["alert_id"], "alert_cj_200")
        self.assertEqual(cj["txid"], "tx_cj_200")
        self.assertEqual(len(cj["flagged_txids"]), 1)
        self.assertEqual(len(cj["risk_hits"]), 0)
        self.assertEqual(cj["total_btc"], 1.275)  # 5 * 0.255 BTC = 1.275 BTC


if __name__ == "__main__":
    unittest.main()
