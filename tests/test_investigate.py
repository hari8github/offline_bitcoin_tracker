from __future__ import annotations

import unittest
from unittest.mock import MagicMock

from agents.agent_schema import InvestigateArgs, TOOL_SCHEMAS
from agents.agent_tools import investigate, TOOL_FUNCTIONS
from agents.intent_router import route
from agents.graph import _format_reply


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
    def __init__(self, query_handler=None):
        self.query_handler = query_handler or (lambda q, p: MockResult(None))

    def session(self):
        return MockSession(self.query_handler)


class TestInvestigateComposite(unittest.TestCase):
    def test_schema_and_tool_registration(self):
        """Ensure investigate tool is registered in TOOL_SCHEMAS and TOOL_FUNCTIONS."""
        self.assertIn("investigate", TOOL_SCHEMAS)
        self.assertIn("investigate", TOOL_FUNCTIONS)
        self.assertEqual(TOOL_SCHEMAS["investigate"], InvestigateArgs)
        self.assertEqual(TOOL_FUNCTIONS["investigate"], investigate)

    def test_intent_router_investigate(self):
        """Ensure generic investigation and catch-all phrasings route to investigate."""
        # Generic phrases
        m1 = route("investigate tx_csv_0040")
        self.assertIsNotNone(m1)
        self.assertEqual(m1[0], "investigate")
        self.assertEqual(m1[1], {"id": "tx_csv_0040"})

        m2 = route("tell me about bc1qcsvPEEL0100")
        self.assertIsNotNone(m2)
        self.assertEqual(m2[0], "investigate")
        self.assertEqual(m2[1], {"id": "bc1qcsvPEEL0100"})

        m3 = route("what do you know about 192.0.2.194")
        self.assertIsNotNone(m3)
        self.assertEqual(m3[0], "investigate")
        self.assertEqual(m3[1], {"id": "192.0.2.194"})

        # Catch-all standalone ID
        m4 = route("tx_csv_0040")
        self.assertIsNotNone(m4)
        self.assertEqual(m4[0], "investigate")
        self.assertEqual(m4[1], {"id": "tx_csv_0040"})

        # Narrower tools remain reachable
        m_sim = route("find transactions similar to tx_csv_0037")
        self.assertEqual(m_sim[0], "find_similar_transactions")

        m_why = route("why was tx_csv_0040 flagged")
        self.assertEqual(m_why[0], "explain_alert")

        m_pat = route("list coinjoin alerts")
        self.assertEqual(m_pat[0], "list_patterns")

    def test_investigate_narrative_coinjoin(self):
        """Verify CoinJoin narrative includes defining mechanism, counts, amounts, and expected absences."""
        cj_investigate_data = {
            "id": "tx_csv_0040",
            "kind": "transaction",
            "own_alerts": {
                "txid": "tx_csv_0040",
                "found": True,
                "alerts": [
                    {
                        "type": "coinjoin_like",
                        "confidence": 1.0,
                        "evidence": {
                            "input_count": 5,
                            "output_count": 5,
                            "output_amounts_sats": [25523798] * 5,
                        },
                    }
                ],
            },
            "similar": {
                "txid": "tx_csv_0040",
                "found": True,
                "shared_counterparty": [],
                "shared_ip": [{"ip": "192.0.2.99", "other_txid": "tx_csv_0004", "role": "src_to_dst"}],
                "shared_asn": [],
                "same_cluster": [],
                "same_pattern_type": [
                    {"other_txid": "tx_csv_0041", "pattern_type": "coinjoin_like", "same_alert": False}
                ],
                "amount_and_time_proximity": [],
            },
        }
        text = _format_reply("investigate", cj_investigate_data)
        self.assertIn("tx_csv_0040 is a CoinJoin-like transaction", text)
        self.assertIn("5 inputs and 5 outputs", text)
        self.assertIn("near-identical amounts (~0.255 BTC each)", text)
        self.assertIn("designed to obscure which input paid which output", text)
        self.assertIn("shares no direct counterparties with other flagged transactions", text)
        self.assertIn("expected for CoinJoin activity", text)
        self.assertIn("It was NOT part of any peeling chain", text)

    def test_investigate_narrative_peeling_chain(self):
        """Verify Peeling Chain narrative includes hop number, chain path, defining mechanism, and literal link."""
        peel_investigate_data = {
            "id": "tx_csv_0037",
            "kind": "transaction",
            "own_alerts": {
                "txid": "tx_csv_0037",
                "found": True,
                "alerts": [
                    {
                        "type": "peeling_chain",
                        "confidence": 0.9,
                        "evidence": {
                            "path": ["tx_csv_0036", "tx_csv_0037", "tx_csv_0038", "tx_csv_0039"],
                            "value_sequence_sats": [1082658155, 1064877841, 1050030005, 1035388288],
                        },
                    }
                ],
            },
            "similar": {
                "txid": "tx_csv_0037",
                "found": True,
                "shared_counterparty": [
                    {
                        "other_txid": "tx_csv_0036",
                        "shared_address": "bc1qcsvPEEL0100",
                        "relation": "input_to_output",
                    },
                    {
                        "other_txid": "tx_csv_0038",
                        "shared_address": "bc1qcsvPEEL0102",
                        "relation": "output_to_input",
                    },
                ],
                "shared_ip": [
                    {"ip": "192.0.2.194", "other_txid": "tx_csv_0036", "role": "same_src_ip"},
                ],
                "shared_asn": [],
                "same_cluster": [],
                "same_pattern_type": [
                    {"other_txid": "tx_csv_0036", "pattern_type": "peeling_chain", "same_alert": True}
                ],
                "amount_and_time_proximity": [],
            },
        }
        text = _format_reply("investigate", peel_investigate_data)
        self.assertIn("hop 2 of a 4-transaction peeling chain", text)
        self.assertIn("tx_csv_0036 → tx_csv_0037 → tx_csv_0038 → tx_csv_0039", text)
        self.assertIn("where a large balance is broken into smaller payments while retaining most value as change at each step", text)
        self.assertIn("shares its input address with tx_csv_0036's output (via bc1qcsvPEEL0100) — that's the literal link forming the chain", text)
        self.assertIn("passes peeling change to tx_csv_0038 via bc1qcsvPEEL0102", text)

    def test_investigate_address_and_ip(self):
        """Verify investigate handles address and IP entity profiles."""
        addr_data = {
            "id": "bc1qcsvPEEL0100",
            "kind": "address",
            "profile": {
                "entity_id": "bc1qcsvPEEL0100",
                "entity_type": "address",
                "transaction_count": 2,
                "role_breakdown": {"as_input": 1, "as_output": 1},
                "counterparty_count": 3,
                "alert_count": 1,
                "alerts": [{"type": "peeling_chain"}],
                "first_seen": "2026-08-04T21:43:00+00:00",
                "last_seen": "2026-08-04T22:11:00+00:00",
                "known_since_days": 0,
            },
        }
        text_addr = _format_reply("investigate", addr_data)
        self.assertIn("Address bc1qcsvPEEL0100:", text_addr)
        self.assertIn("2 transaction(s)", text_addr)
        self.assertIn("1 in, 1 out", text_addr)
        self.assertIn("Directly involved in 1 alert finding(s)", text_addr)
        self.assertIn("(same day)", text_addr)

        ip_data = {
            "id": "192.0.2.194",
            "kind": "ip",
            "profile": {
                "entity_id": "192.0.2.194",
                "entity_type": "ip",
                "transaction_count": 4,
                "address_count": 9,
                "alert_count": 1,
                "first_seen": "2026-08-04T21:43:00+00:00",
                "last_seen": "2026-08-04T23:50:00+00:00",
                "known_since_days": 0,
            },
        }
        text_ip = _format_reply("investigate", ip_data)
        self.assertIn("IP 192.0.2.194:", text_ip)
        self.assertIn("4 transaction(s)", text_ip)
        self.assertIn("9 address(es)", text_ip)
        self.assertIn("Associated with 1 alert finding(s)", text_ip)
        self.assertIn("(same day)", text_ip)


if __name__ == "__main__":
    unittest.main()
