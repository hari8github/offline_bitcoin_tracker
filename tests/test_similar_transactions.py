from __future__ import annotations

import unittest
from datetime import datetime, timezone

from agents.agent_schema import SimilarTransactionsArgs, TOOL_SCHEMAS
from agents.agent_tools import find_similar_transactions, TOOL_FUNCTIONS
from agents.graph import _format_reply
from agents.intent_router import route


class MockResult:
    def __init__(self, data=None):
        self.data = data

    def single(self):
        return self.data

    def get(self, key, default=None):
        if isinstance(self.data, dict):
            return self.data.get(key, default)
        return default

    def __iter__(self):
        if self.data is None:
            return iter([])
        if isinstance(self.data, list):
            return iter(self.data)
        return iter([self.data])


class MockSession:
    def __init__(self, query_handler):
        self.query_handler = query_handler

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

    def run(self, query, **params):
        return self.query_handler(query, params)


class MockDriver:
    def __init__(self, query_handler):
        self.query_handler = query_handler

    def session(self):
        return MockSession(self.query_handler)


class TestSimilarTransactions(unittest.TestCase):
    def test_schema_and_tool_registration(self):
        """Ensure find_similar_transactions is properly registered in schema and tools."""
        self.assertIn("find_similar_transactions", TOOL_SCHEMAS)
        self.assertIn("find_similar_transactions", TOOL_FUNCTIONS)
        self.assertEqual(TOOL_SCHEMAS["find_similar_transactions"], SimilarTransactionsArgs)
        self.assertEqual(TOOL_FUNCTIONS["find_similar_transactions"], find_similar_transactions)

    def test_tx_not_found(self):
        """Unknown transaction returns found: False with all empty lists."""
        def handler(query, params):
            return MockResult(None)

        driver = MockDriver(handler)
        res = find_similar_transactions(driver, case_id="CASE_001", txid="tx_unknown_999")
        self.assertFalse(res["found"])
        self.assertEqual(res["txid"], "tx_unknown_999")
        self.assertEqual(res["shared_counterparty"], [])
        self.assertEqual(res["shared_ip"], [])
        self.assertEqual(res["shared_asn"], [])
        self.assertEqual(res["shared_asn_count"], 0)
        self.assertEqual(res["same_cluster"], [])
        self.assertEqual(res["same_pattern_type"], [])
        self.assertEqual(res["amount_and_time_proximity"], [])

    def test_bounding_per_category(self):
        """Each category is capped independently at max_per_category, preserving true count."""
        large_list = [{"other_txid": f"tx_{i}", "val": i} for i in range(30)]

        def handler(query, params):
            if "RETURN t.txid AS txid" in query:
                return MockResult({"txid": "tx_test"})
            return MockResult({"matches": large_list, "total_count": 30})

        driver = MockDriver(handler)
        res = find_similar_transactions(driver, case_id="CASE_001", txid="tx_test", max_per_category=5)
        self.assertTrue(res["found"])
        self.assertEqual(len(res["shared_counterparty"]), 5)
        self.assertEqual(len(res["shared_ip"]), 5)
        self.assertEqual(len(res["shared_asn"]), 5)
        self.assertEqual(res["shared_asn_count"], 30)
        self.assertEqual(len(res["same_cluster"]), 5)
        self.assertEqual(len(res["same_pattern_type"]), 5)
        self.assertEqual(len(res["amount_and_time_proximity"]), 5)

    def test_peeling_chain_hop_relations(self):
        """Verify peeling-chain hop returns directional relationships and matching pattern."""
        def handler(query, params):
            if "RETURN t.txid AS txid" in query:
                return MockResult({"txid": "tx_csv_0037"})
            if "shared_address" in query:
                return MockResult({
                    "matches": [
                        {
                            "other_txid": "tx_csv_0038",
                            "shared_address": "bc1qcsvPEEL0102",
                            "relation": "output_to_input",
                        },
                        {
                            "other_txid": "tx_csv_0036",
                            "shared_address": "bc1qcsvPEEL0100",
                            "relation": "input_to_output",
                        },
                    ]
                })
            if "al_other.type = al.type" in query:
                return MockResult({
                    "matches": [
                        {"other_txid": "tx_csv_0038", "pattern_type": "peeling_chain", "confidence": 0.9, "same_alert": True},
                        {"other_txid": "tx_csv_0039", "pattern_type": "peeling_chain", "confidence": 0.9, "same_alert": True},
                    ]
                })
            return MockResult({"matches": []})

        driver = MockDriver(handler)
        res = find_similar_transactions(driver, case_id="CASE_2026_001", txid="tx_csv_0037")
        self.assertTrue(res["found"])
        cps = res["shared_counterparty"]
        self.assertEqual(len(cps), 2)
        relations = {c["other_txid"]: (c["shared_address"], c["relation"]) for c in cps}
        self.assertIn("tx_csv_0036", relations)
        self.assertEqual(relations["tx_csv_0036"], ("bc1qcsvPEEL0100", "input_to_output"))
        self.assertIn("tx_csv_0038", relations)
        self.assertEqual(relations["tx_csv_0038"], ("bc1qcsvPEEL0102", "output_to_input"))

        pats = res["same_pattern_type"]
        self.assertEqual(len(pats), 2)
        pat_txids = [p["other_txid"] for p in pats]
        self.assertIn("tx_csv_0038", pat_txids)
        self.assertIn("tx_csv_0039", pat_txids)
        for p in pats:
            self.assertTrue(p["same_alert"])

    def test_coinjoin_isolation(self):
        """Verify CoinJoin has empty shared counterparties while linking same_pattern_type."""
        def handler(query, params):
            if "RETURN t.txid AS txid" in query:
                return MockResult({"txid": "tx_csv_0040"})
            if "shared_address" in query:
                return MockResult({"matches": []})
            if "al_other.type = al.type" in query:
                return MockResult({
                    "matches": [
                        {"other_txid": "tx_json_0040", "pattern_type": "coinjoin_like", "confidence": 1.0, "same_alert": False},
                        {"other_txid": "tx_xml_0040", "pattern_type": "coinjoin_like", "confidence": 1.0, "same_alert": False},
                        {"other_txid": "tx_csv_0041", "pattern_type": "coinjoin_like", "confidence": 1.0, "same_alert": False},
                        {"other_txid": "tx_json_0041", "pattern_type": "coinjoin_like", "confidence": 1.0, "same_alert": False},
                        {"other_txid": "tx_xml_0041", "pattern_type": "coinjoin_like", "confidence": 1.0, "same_alert": False},
                    ]
                })
            return MockResult({"matches": []})

        driver = MockDriver(handler)
        res = find_similar_transactions(driver, case_id="CASE_2026_001", txid="tx_csv_0040")
        self.assertTrue(res["found"])
        self.assertEqual(res["shared_counterparty"], [])
        self.assertEqual(len(res["same_pattern_type"]), 5)
        for p in res["same_pattern_type"]:
            self.assertEqual(p["pattern_type"], "coinjoin_like")
            self.assertFalse(p["same_alert"])

    def test_intent_router_similar(self):
        """Verify router matches 'similar to', 'cross-reference' with txid."""
        m1 = route("find transactions similar to tx_csv_0037")
        self.assertIsNotNone(m1)
        self.assertEqual(m1[0], "find_similar_transactions")
        self.assertEqual(m1[1], {"txid": "tx_csv_0037"})

        m2 = route("cross-reference tx_csv_0040")
        self.assertIsNotNone(m2)
        self.assertEqual(m2[0], "find_similar_transactions")
        self.assertEqual(m2[1], {"txid": "tx_csv_0040"})

    def test_format_reply_phrasing(self):
        """Verify phrasing layer handles strong matches vs proximity-only weak matches."""
        # Strong match with broad ASN context
        strong_data = {
            "txid": "tx_csv_0037",
            "found": True,
            "shared_counterparty": [
                {"other_txid": "tx_csv_0038", "relation": "output_to_input"},
                {"other_txid": "tx_csv_0036", "relation": "input_to_output"},
            ],
            "shared_asn": [
                {"other_txid": f"tx_{i}", "asn": 64500, "country": "IN"} for i in range(10)
            ],
            "shared_asn_count": 44,
            "same_pattern_type": [
                {"other_txid": "tx_csv_0038", "pattern_type": "peeling_chain", "same_alert": True},
                {"other_txid": "tx_json_0038", "pattern_type": "peeling_chain", "same_alert": False},
            ],
            "amount_and_time_proximity": [
                {"other_txid": "tx_csv_0038", "amount_diff_pct": 1.39, "time_diff_hours": 0.67},
            ],
        }
        r_strong = _format_reply("find_similar_transactions", strong_data)
        self.assertIn("Similar transactions for tx_csv_0037:", r_strong)
        self.assertIn("shared counterparty", r_strong)
        self.assertIn("same alert/chain", r_strong)
        self.assertIn("other transaction(s) of same general type", r_strong)
        self.assertIn("44 transaction(s) share ASN 64500 (10 sampled — broad network context)", r_strong)
        self.assertNotIn("Worth noting", r_strong)

        # Proximity-only match (weaker evidence phrasing)
        weak_data = {
            "txid": "tx_test_isolated",
            "found": True,
            "shared_counterparty": [],
            "shared_ip": [],
            "shared_asn": [],
            "same_cluster": [],
            "same_pattern_type": [],
            "amount_and_time_proximity": [
                {"other_txid": "tx_other_1", "amount_diff_pct": 2.5, "time_diff_hours": 4.0},
            ],
        }
        r_weak = _format_reply("find_similar_transactions", weak_data)
        self.assertIn("Worth noting:", r_weak)
        self.assertIn("similar amount & timing", r_weak)


if __name__ == "__main__":
    unittest.main()
