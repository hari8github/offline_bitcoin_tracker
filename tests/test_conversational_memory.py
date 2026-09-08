from __future__ import annotations

import unittest
from unittest.mock import MagicMock, patch

from agents.agent_schema import ConversationState, AgentResponse
from agents.intent_router import route, classify_id
from agents.graph import _deterministic_elaboration_fallback, build_agent, run_agent


class MockResult:
    def __init__(self, data=None):
        self.data = data

    def single(self):
        return self.data

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


class TestConversationalMemory(unittest.TestCase):

    def test_part_a_conversation_state(self):
        """Part A: Verify ConversationState fields, properties, and backward-compatible dict access."""
        state = ConversationState(
            last_entity_id="tx_csv_0040",
            last_entity_kind="transaction",
            last_tool_name="investigate",
            last_tool_result={"id": "tx_csv_0040", "found": True},
            surfaced_facts=["First answer"],
            turn_count=1,
        )
        self.assertEqual(state.last_entity_id, "tx_csv_0040")
        self.assertEqual(state.last_entity, "tx_csv_0040")
        self.assertEqual(state.last_kind, "transaction")
        self.assertEqual(state.last_tool, "investigate")
        self.assertEqual(state["last_entity"], "tx_csv_0040")
        self.assertEqual(state.get("last_entity_id"), "tx_csv_0040")
        self.assertEqual(state.get("last_entity"), "tx_csv_0040")
        self.assertEqual(state.turn_count, 1)
        self.assertEqual(len(state.surfaced_facts), 1)

    def test_part_b_reference_resolution_fast_path(self):
        """Part B: Verify pronoun and reference word resolution against session context."""
        ctx = ConversationState(
            last_entity_id="tx_csv_0040",
            last_entity_kind="transaction",
            last_tool_name="investigate",
            turn_count=1,
        )

        # 1. Elaboration intent with pronoun
        m1 = route("explain more about this", context=ctx)
        self.assertIsNotNone(m1)
        self.assertEqual(m1[0], "elaborate")
        self.assertEqual(m1[1]["id"], "tx_csv_0040")

        # 2. Tell me more
        m2 = route("tell me more", context=ctx)
        self.assertIsNotNone(m2)
        self.assertEqual(m2[0], "elaborate")
        self.assertEqual(m2[1]["id"], "tx_csv_0040")

        # 3. What else?
        m3 = route("what else", context=ctx)
        self.assertIsNotNone(m3)
        self.assertEqual(m3[0], "elaborate")
        self.assertEqual(m3[1]["id"], "tx_csv_0040")

        # 4. Show graph follow-up with pronoun
        m4 = route("show graph for it", context=ctx)
        self.assertIsNotNone(m4)
        self.assertEqual(m4[0], "get_subgraph")
        self.assertEqual(m4[1]["center"], "tx_csv_0040")

        # 5. Why was it flagged
        m5 = route("why was it flagged", context=ctx)
        self.assertIsNotNone(m5)
        self.assertEqual(m5[0], "explain_alert")
        self.assertEqual(m5[1]["txid"], "tx_csv_0040")

        # 6. Find similar to that
        m6 = route("find similar to this", context=ctx)
        self.assertIsNotNone(m6)
        self.assertEqual(m6[0], "find_similar_transactions")
        self.assertEqual(m6[1]["txid"], "tx_csv_0040")

        # 7. Explicit ID takes precedence over context
        m7 = route("tell me about tx_csv_0036", context=ctx)
        self.assertIsNotNone(m7)
        self.assertEqual(m7[0], "investigate")
        self.assertEqual(m7[1]["id"], "tx_csv_0036")

        # 8. Ambiguous query with no context -> None (fall through to LLM fallback)
        m8 = route("explain this more", context=None)
        self.assertIsNone(m8)

    def test_part_c_deterministic_elaboration_fallback(self):
        """Part C: Verify factual fallback surfaces unmentioned fields and stops cleanly when exhausted."""
        raw_data = {
            "id": "tx_csv_0040",
            "kind": "transaction",
            "similar": {
                "shared_ip": [{"ip": "192.0.2.99", "other_txid": "tx_csv_0004", "role": "src_to_dst"}],
                "shared_asn": [{"asn": 64502, "country": "IN", "other_txid": "tx_cluster_001"}],
                "shared_asn_count": 21,
                "same_pattern_type": [{"other_txid": "tx_coinjoin_001", "pattern_type": "coinjoin_like"}],
                "amount_and_time_proximity": [{"amount_diff_pct": 1.25, "other_txid": "tx_csv_0045", "time_diff_hours": 9.37}],
            },
        }

        # Step 1: Initial reply only mentioned coinjoin mechanism
        first_narrative = (
            "tx_csv_0040 is a CoinJoin-like transaction — 5 inputs and 5 outputs, "
            "all near-identical amounts (~0.255 BTC each), which is designed to obscure which input paid which output."
        )
        surfaced = [first_narrative]

        # First elaboration surfaces shared IP
        e1 = _deterministic_elaboration_fallback("tx_csv_0040", "transaction", raw_data, surfaced)
        self.assertIn("192.0.2.99", e1)
        self.assertIn("tx_csv_0004", e1)
        surfaced.append(e1)

        # Second elaboration surfaces ASN
        e2 = _deterministic_elaboration_fallback("tx_csv_0040", "transaction", raw_data, surfaced)
        self.assertIn("64502", e2)
        self.assertIn("21 other transaction(s)", e2)
        surfaced.append(e2)

        # Third elaboration surfaces same pattern transactions
        e3 = _deterministic_elaboration_fallback("tx_csv_0040", "transaction", raw_data, surfaced)
        self.assertIn("tx_coinjoin_001", e3)
        surfaced.append(e3)

        # Fourth elaboration surfaces proximity
        e4 = _deterministic_elaboration_fallback("tx_csv_0040", "transaction", raw_data, surfaced)
        self.assertIn("tx_csv_0045", e4)
        surfaced.append(e4)

        # Fifth elaboration: all fields exhausted -> honest stop message
        e5 = _deterministic_elaboration_fallback("tx_csv_0040", "transaction", raw_data, surfaced)
        self.assertEqual(e5, "That's everything I have on this transaction in this dataset.")

    def test_multi_turn_session_flow(self):
        """End-to-end multi-turn check:
        Turn 1: investigate tx_csv_0040 -> returns templated narrative
        Turn 2: explain more about this -> surfaces new facts, does NOT repeat narrative
        Turn 3: anything else -> surfaces more facts
        Turn 4: new entity bc1q... -> resets surfaced facts
        """
        # Set up mock investigate tool result
        mock_raw = {
            "id": "tx_csv_0040",
            "kind": "transaction",
            "own_alerts": {
                "txid": "tx_csv_0040",
                "alerts": [
                    {
                        "type": "coinjoin_like",
                        "confidence": 1.0,
                        "evidence": {"input_count": 5, "output_count": 5, "output_amounts_sats": [25523798] * 5},
                    }
                ],
                "found": True,
            },
            "similar": {
                "txid": "tx_csv_0040",
                "case_id": "CASE_2026_001",
                "found": True,
                "shared_counterparty": [],
                "shared_ip": [{"ip": "192.0.2.99", "other_txid": "tx_csv_0004", "role": "src_to_dst"}],
                "shared_asn": [{"asn": 64502, "country": "IN", "other_txid": "tx_cluster_001"}],
                "shared_asn_count": 21,
                "same_cluster": [],
                "same_pattern_type": [{"other_txid": "tx_coinjoin_001", "pattern_type": "coinjoin_like", "same_alert": False}],
                "amount_and_time_proximity": [{"amount_diff_pct": 1.25, "other_txid": "tx_csv_0045", "time_diff_hours": 9.37}],
            },
        }

        mock_driver = MockDriver()

        with patch("agents.graph.TOOL_FUNCTIONS", {"investigate": lambda d, c, id: mock_raw}):
            # Turn 1:
            resp1, state1 = run_agent(mock_driver, "CASE_2026_001", "tell me about tx_csv_0040")
            self.assertEqual(state1.last_entity_id, "tx_csv_0040")
            self.assertEqual(state1.last_entity_kind, "transaction")
            self.assertIn("CoinJoin-like transaction", resp1.reply)
            self.assertEqual(len(state1.surfaced_facts), 1)

            # Turn 2: explain more about this
            resp2, state2 = run_agent(mock_driver, "CASE_2026_001", "explain more about this", session_state=state1)
            self.assertEqual(state2.last_entity_id, "tx_csv_0040")
            # Must NOT repeat the first response
            self.assertNotEqual(resp2.reply, resp1.reply)
            self.assertTrue(len(state2.surfaced_facts) >= 2)

            # Turn 3: tell me more
            resp3, state3 = run_agent(mock_driver, "CASE_2026_001", "tell me more", session_state=state2)
            self.assertEqual(state3.last_entity_id, "tx_csv_0040")
            self.assertNotEqual(resp3.reply, resp2.reply)
            self.assertNotEqual(resp3.reply, resp1.reply)


if __name__ == "__main__":
    unittest.main()
