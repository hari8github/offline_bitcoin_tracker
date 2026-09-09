from __future__ import annotations

import unittest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from api import app, DEFAULT_CASE_ID


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


class TestDashboardEndpoints(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    @patch("api._driver")
    def test_risk_exposure_endpoint(self, mock_driver):
        sample_rows = [
            {
                "address": "bc1qseed1",
                "entity_name": "Lazarus Cluster",
                "risk_score": 1.0,
                "direct_in_sats": 50000000,
                "direct_out_sats": 100000000,
                "hop1_addrs": 3,
                "hop2_addrs": 7,
                "hop3_addrs": 15,
            }
        ]

        def query_handler(q, params):
            return MockResult(sample_rows)

        mock_driver.return_value = MockDriverCtx(query_handler)

        res = self.client.get(f"/dashboard/risk-exposure?case_id={DEFAULT_CASE_ID}")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["case_id"], DEFAULT_CASE_ID)
        self.assertEqual(len(data["seeds"]), 1)
        seed = data["seeds"][0]
        self.assertEqual(seed["address"], "bc1qseed1")
        self.assertEqual(seed["entity_name"], "Lazarus Cluster")
        self.assertEqual(seed["risk_score"], 1.0)
        self.assertEqual(seed["direct_in_btc"], 0.5)
        self.assertEqual(seed["direct_out_btc"], 1.0)
        self.assertEqual(seed["total_direct_btc"], 1.5)
        self.assertEqual(seed["hop1_addrs"], 3)
        self.assertEqual(seed["hop2_addrs"], 7)
        self.assertEqual(seed["hop3_addrs"], 15)

    @patch("api._driver")
    def test_risk_exposure_empty(self, mock_driver):
        def query_handler(q, params):
            return MockResult([])

        mock_driver.return_value = MockDriverCtx(query_handler)

        res = self.client.get("/dashboard/risk-exposure?case_id=NONEXISTENT")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["seeds"], [])

    @patch("api._driver")
    def test_structural_flags_endpoint(self, mock_driver):
        # 4 spends within 30 minutes -> burst
        burst_spends = [
            {"txid": "tx1", "timestamp": "2026-03-01T12:00:00Z", "amount_sats": 100000},
            {"txid": "tx2", "timestamp": "2026-03-01T12:10:00Z", "amount_sats": 100000},
            {"txid": "tx3", "timestamp": "2026-03-01T12:20:00Z", "amount_sats": 100000},
            {"txid": "tx4", "timestamp": "2026-03-01T12:30:00Z", "amount_sats": 100000},
        ]
        burst_rows = [
            {"address": "bc1qburst1", "entity_name": "Fast Spender", "spends": burst_spends}
        ]
        reuse_row = {
            "total_reused_addresses": 5,
            "sample_reused": [
                {
                    "address": "bc1qreused1",
                    "entity_name": "",
                    "received_tx_count": 2,
                    "spent_tx_count": 1,
                    "received_sats": 200000000,
                    "spent_sats": 150000000,
                }
            ],
        }

        def query_handler(q, params):
            if "total_reused_addresses" in q:
                return MockResult(reuse_row)
            return MockResult(burst_rows)

        mock_driver.return_value = MockDriverCtx(query_handler)

        res = self.client.get(f"/dashboard/structural-flags?case_id={DEFAULT_CASE_ID}")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data["burst_senders"]), 1)
        b = data["burst_senders"][0]
        self.assertEqual(b["address"], "bc1qburst1")
        self.assertEqual(b["burst_count"], 4)
        self.assertEqual(b["sample_txids"], ["tx1", "tx2", "tx3", "tx4"])
        self.assertEqual(data["address_reuse"]["total_reused_addresses"], 5)
        self.assertEqual(data["address_reuse"]["sample_reused"][0]["received_btc"], 2.0)
        self.assertEqual(data["address_reuse"]["sample_reused"][0]["spent_btc"], 1.5)

    @patch("api.detect_peeling_chain")
    @patch("api.detect_coinjoin")
    @patch("api._driver")
    def test_case_highlights_endpoint(self, mock_driver, mock_cj, mock_peel):
        mock_driver.return_value = MockDriverCtx(lambda q, p: MockResult([]))
        mock_cj.return_value = [
            {
                "alert_id": "CJ_001",
                "txid": "tx_cj_01",
                "confidence": 0.95,
                "evidence": {
                    "input_count": 5,
                    "output_count": 5,
                    "output_amounts_sats": [25500000] * 5,
                },
            }
        ]
        mock_peel.return_value = [
            {
                "alert_id": "PEEL_001",
                "txid": "tx_peel_start",
                "confidence": 0.88,
                "path": ["tx_peel_start", "tx_peel_mid", "tx_peel_end"],
                "evidence": {
                    "value_sequence_sats": [100000000, 70000000, 40000000],
                },
            }
        ]

        res = self.client.get(f"/dashboard/case-highlights?case_id={DEFAULT_CASE_ID}")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        peel = data["longest_peeling_chain"]
        self.assertIsNotNone(peel)
        self.assertEqual(peel["chain_length"], 3)
        self.assertEqual(peel["start_txid"], "tx_peel_start")
        self.assertEqual(peel["end_txid"], "tx_peel_end")
        self.assertEqual(peel["peeled_off_btc"], 0.6)  # 1.0 - 0.4
        self.assertEqual(peel["start_balance_btc"], 1.0)
        self.assertEqual(peel["end_balance_btc"], 0.4)

        cj = data["largest_coinjoin"]
        self.assertIsNotNone(cj)
        self.assertEqual(cj["input_count"], 5)
        self.assertEqual(cj["equal_output_count"], 5)
        self.assertEqual(cj["denomination_btc"], 0.255)
        self.assertEqual(cj["total_btc"], 1.275)

    @patch("api._driver")
    def test_fee_outliers_endpoint(self, mock_driver):
        # Normal fees around 10k sats, one high spike at 100k sats, and one zero fee
        tx_rows = [
            {"txid": "tx_norm_1", "fee_sats": 10000, "input_sats": 1000000, "output_sats": 990000, "timestamp": "2026-03-01T10:00:00Z"},
            {"txid": "tx_norm_2", "fee_sats": 11000, "input_sats": 1000000, "output_sats": 989000, "timestamp": "2026-03-01T10:05:00Z"},
            {"txid": "tx_norm_3", "fee_sats": 9000, "input_sats": 1000000, "output_sats": 991000, "timestamp": "2026-03-01T10:10:00Z"},
            {"txid": "tx_norm_4", "fee_sats": 10500, "input_sats": 1000000, "output_sats": 989500, "timestamp": "2026-03-01T10:15:00Z"},
            {"txid": "tx_spike", "fee_sats": 100000, "input_sats": 1000000, "output_sats": 900000, "timestamp": "2026-03-01T10:20:00Z"},
            {"txid": "tx_zero", "fee_sats": 0, "input_sats": 500000, "output_sats": 500000, "timestamp": "2026-03-01T10:25:00Z"},
        ]

        def query_handler(q, params):
            return MockResult(tx_rows)

        mock_driver.return_value = MockDriverCtx(query_handler)

        res = self.client.get(f"/dashboard/fee-outliers?case_id={DEFAULT_CASE_ID}")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["total_tx_with_fees"], 6)
        self.assertGreater(data["mean_fee_sats"], 0)
        self.assertGreater(data["stddev_fee_sats"], 0)
        self.assertGreater(data["high_threshold_sats"], data["mean_fee_sats"])

        # tx_spike should exceed threshold
        high_outliers = data["high_outliers"]
        self.assertEqual(len(high_outliers), 1)
        self.assertEqual(high_outliers[0]["txid"], "tx_spike")
        self.assertEqual(high_outliers[0]["fee_btc"], 0.001)
        self.assertGreater(high_outliers[0]["sigma_score"], 2.0)

        # tx_zero should be in zero_fee_transactions
        zero_txs = data["zero_fee_transactions"]
        self.assertEqual(len(zero_txs), 1)
        self.assertEqual(zero_txs[0]["txid"], "tx_zero")
        self.assertEqual(zero_txs[0]["fee_btc"], 0.0)


if __name__ == "__main__":
    unittest.main()
