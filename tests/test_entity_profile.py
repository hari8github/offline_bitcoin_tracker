from __future__ import annotations

import unittest
from datetime import datetime, timezone

from agents.agent_schema import EntityProfileArgs, TOOL_SCHEMAS
from agents.agent_tools import get_entity_profile, TOOL_FUNCTIONS
from agents.graph import _format_reply
from agents.intent_router import route


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

    def run(self, query, **kwargs):
        return self.query_handler(query, kwargs)


class MockDriver:
    def __init__(self, query_handler):
        self.query_handler = query_handler

    def session(self):
        return MockSession(self.query_handler)


class TestEntityProfile(unittest.TestCase):
    def test_schema_and_tool_registration(self):
        """Verify schema models and tool registry mappings."""
        self.assertIn("get_entity_profile", TOOL_SCHEMAS)
        self.assertIn("get_entity_profile", TOOL_FUNCTIONS)
        self.assertEqual(TOOL_SCHEMAS["get_entity_profile"], EntityProfileArgs)
        self.assertEqual(TOOL_FUNCTIONS["get_entity_profile"], get_entity_profile)

        # Validation
        args = EntityProfileArgs(entity_id="bc1qcsvPEEL0100", entity_type="address")
        self.assertEqual(args.entity_id, "bc1qcsvPEEL0100")
        self.assertEqual(args.entity_type, "address")

    def test_seeded_peeling_chain_address(self):
        """Definition of Done:
        running get_entity_profile(driver, 'CASE_2026_001', 'bc1qcsvPEEL0100', 'address')
        returns correct transaction count (2), correct counterparties, and peeling_chain alert.
        """
        ts1 = datetime(2026, 8, 4, 21, 43, 0, tzinfo=timezone.utc)
        ts2 = datetime(2026, 8, 4, 22, 11, 0, tzinfo=timezone.utc)

        def handler(query, params):
            q = query.strip()
            # 1. Stats query
            if "OPTIONAL MATCH (a)-[s:SPENDS]->(t_in:Transaction)" in q:
                return MockResult({
                    "address": "bc1qcsvPEEL0100",
                    "risk_score": None,
                    "as_input": 1,
                    "as_output": 1,
                    "total_sent": 1065410546,
                    "total_received": 1065410546,
                    "in_tx_list": [{"txid": "tx_csv_0037", "ts": ts2}],
                    "out_tx_list": [{"txid": "tx_csv_0036", "ts": ts1}],
                })
            # 2. Counterparties query
            if "collect(cp) AS counterparties" in q:
                return MockResult({
                    "counterparties": [
                        "bc1qcsvPEEL0099",
                        "bc1qcsvPEELCHG0101",
                        "bc1qcsvPEEL0102",
                        "bc1qcsvPEELCHG0103",
                    ]
                })
            # 3. Associated IPs
            if "item.ip AS ip" in q:
                return [
                    {"ip": "192.0.2.194", "country": "IN", "asn": 64500},
                    {"ip": "192.0.2.180", "country": "IN", "asn": 64500},
                ]
            # 4. Cluster membership
            if "clusters" in q:
                return MockResult({"clusters": []})
            # 5. Alerts query
            if "collect({alert_id: alert_id" in q:
                return MockResult({
                    "alerts": [
                        {
                            "alert_id": "alert_CASE_2026_001_tx_csv_0036_tx_csv_0037_peeling_chain",
                            "type": "peeling_chain",
                            "confidence": 0.81,
                            "txid": "tx_csv_0036",
                        }
                    ]
                })
            return MockResult({})

        driver = MockDriver(handler)
        profile = get_entity_profile(driver, "CASE_2026_001", "bc1qcsvPEEL0100", "address")

        self.assertEqual(profile["entity_id"], "bc1qcsvPEEL0100")
        self.assertEqual(profile["entity_type"], "address")
        self.assertEqual(profile["case_id"], "CASE_2026_001")
        self.assertEqual(profile["transaction_count"], 2)
        self.assertEqual(profile["role_breakdown"], {"as_input": 1, "as_output": 1})
        self.assertEqual(profile["total_sent_sats"], 1065410546)
        self.assertEqual(profile["total_received_sats"], 1065410546)
        self.assertEqual(profile["counterparty_count"], 4)
        self.assertIn("bc1qcsvPEEL0099", profile["counterparties"])
        self.assertIn("bc1qcsvPEEL0102", profile["counterparties"])
        self.assertEqual(len(profile["alerts"]), 1)
        self.assertEqual(profile["alerts"][0]["type"], "peeling_chain")
        self.assertEqual(profile["alerts"][0]["confidence"], 0.81)
        self.assertEqual(profile["alerts"][0]["txid"], "tx_csv_0036")
        self.assertEqual(profile["alert_count"], 1)
        self.assertIn("2026-08-04", profile["first_seen"])
        self.assertIn("2026-08-04", profile["last_seen"])

    def test_ip_profile(self):
        """Verify IP profile shape and mapping."""
        ts = datetime(2026, 8, 4, 21, 43, 0, tzinfo=timezone.utc)

        def handler(query, params):
            q = query.strip()
            # 1. Transactions for IP
            if "t.total_input_sats AS total_input_sats" in q:
                return [
                    {
                        "txid": "tx_csv_0036",
                        "timestamp": ts,
                        "total_input_sats": 1083199754,
                        "total_output_sats": 1082658155,
                        "geo_country": "IN",
                        "asn": 64500,
                    },
                    {
                        "txid": "tx_csv_0037",
                        "timestamp": ts,
                        "total_input_sats": 1065410546,
                        "total_output_sats": 1064878441,
                        "geo_country": "IN",
                        "asn": 64500,
                    },
                ]
            # 2. Addresses communicating via IP
            if "collect(addr) AS addresses" in q:
                return MockResult({
                    "addresses": [
                        "bc1qcsvPEEL0099",
                        "bc1qcsvPEEL0100",
                        "bc1qcsvPEEL0102",
                    ]
                })
            # 3. Alerts for IP
            if "collect({alert_id: alert_id" in q:
                return MockResult({
                    "alerts": [
                        {
                            "alert_id": "alert_1",
                            "type": "peeling_chain",
                            "confidence": 0.85,
                            "txid": "tx_csv_0036",
                        }
                    ]
                })
            return MockResult({})

        driver = MockDriver(handler)
        profile = get_entity_profile(driver, "CASE_2026_001", "192.0.2.194", "ip")

        self.assertEqual(profile["entity_id"], "192.0.2.194")
        self.assertEqual(profile["entity_type"], "ip")
        self.assertEqual(profile["transaction_count"], 2)
        self.assertEqual(profile["transactions_observed_from_this_ip"], ["tx_csv_0036", "tx_csv_0037"])
        self.assertEqual(profile["transaction_observed_count"], 2)
        self.assertEqual(profile["address_count"], 3)
        self.assertEqual(profile["addresses_seen_communicating_via_this_ip"], [
            "bc1qcsvPEEL0099",
            "bc1qcsvPEEL0100",
            "bc1qcsvPEEL0102",
        ])
        self.assertEqual(profile["associated_ips"], [{"ip": "192.0.2.194", "country": "IN", "asn": 64500}])
        self.assertEqual(len(profile["alerts"]), 1)
        self.assertEqual(profile["alerts"][0]["type"], "peeling_chain")

    def test_edge_case_unseen_entity(self):
        """Entity never seen in this case -> returns a clearly-empty profile, not an error."""
        def handler(query, params):
            return MockResult(None)

        driver = MockDriver(handler)
        # Unseen address
        addr_profile = get_entity_profile(driver, "CASE_2026_001", "bc1qunknown999", "address")
        self.assertEqual(addr_profile["transaction_count"], 0)
        self.assertIsNone(addr_profile["first_seen"])
        self.assertIsNone(addr_profile["last_seen"])
        self.assertEqual(addr_profile["total_sent_sats"], 0)
        self.assertEqual(addr_profile["total_received_sats"], 0)
        self.assertEqual(addr_profile["role_breakdown"], {"as_input": 0, "as_output": 0})
        self.assertEqual(addr_profile["counterparties"], [])
        self.assertEqual(addr_profile["counterparty_count"], 0)
        self.assertEqual(addr_profile["associated_ips"], [])
        self.assertEqual(addr_profile["cluster_membership"], [])
        self.assertEqual(addr_profile["alerts"], [])
        self.assertEqual(addr_profile["alert_count"], 0)
        self.assertEqual(addr_profile["known_since_days"], 0)

        # Unseen IP
        def empty_ip_handler(query, params):
            return []
        ip_driver = MockDriver(empty_ip_handler)
        ip_profile = get_entity_profile(ip_driver, "CASE_2026_001", "198.51.100.1", "ip")
        self.assertEqual(ip_profile["transaction_count"], 0)
        self.assertEqual(ip_profile["transactions_observed_from_this_ip"], [])
        self.assertEqual(ip_profile["addresses_seen_communicating_via_this_ip"], [])
        self.assertEqual(ip_profile["alerts"], [])
        self.assertEqual(ip_profile["alert_count"], 0)

    def test_edge_case_zero_alerts(self):
        """Entity exists but has zero alerts -> alerts: [], not omitted."""
        ts = datetime(2026, 8, 4, 21, 43, 0, tzinfo=timezone.utc)

        def handler(query, params):
            q = query.strip()
            if "OPTIONAL MATCH (a)-[s:SPENDS]->(t_in:Transaction)" in q:
                return MockResult({
                    "address": "bc1qclean01",
                    "risk_score": None,
                    "as_input": 1,
                    "as_output": 0,
                    "total_sent": 50000,
                    "total_received": 0,
                    "in_tx_list": [{"txid": "tx_clean_1", "ts": ts}],
                    "out_tx_list": [],
                })
            if "collect(cp) AS counterparties" in q:
                return MockResult({"counterparties": ["bc1qdest"]})
            if "item.ip AS ip" in q:
                return []
            if "clusters" in q:
                return MockResult({"clusters": []})
            if "collect({alert_id: alert_id" in q:
                return MockResult({"alerts": []})
            return MockResult({})

        driver = MockDriver(handler)
        profile = get_entity_profile(driver, "CASE_2026_001", "bc1qclean01", "address")
        self.assertIn("alerts", profile)
        self.assertEqual(profile["alerts"], [])
        self.assertEqual(profile["alert_count"], 0)

    def test_edge_case_ip_without_geo_enrichment(self):
        """IP with no geo_country/asn enrichment yet -> returns null, doesn't crash."""
        ts = datetime(2026, 8, 4, 21, 43, 0, tzinfo=timezone.utc)

        def handler(query, params):
            q = query.strip()
            if "t.total_input_sats AS total_input_sats" in q:
                return [
                    {
                        "txid": "tx_raw_ip",
                        "timestamp": ts,
                        "total_input_sats": 1000,
                        "total_output_sats": 900,
                        "geo_country": None,
                        "asn": None,
                    }
                ]
            if "collect(addr) AS addresses" in q:
                return MockResult({"addresses": ["bc1qpeer"]})
            if "collect({alert_id: alert_id" in q:
                return MockResult({"alerts": []})
            return MockResult({})

        driver = MockDriver(handler)
        profile = get_entity_profile(driver, "CASE_2026_001", "10.0.0.1", "ip")
        self.assertEqual(profile["associated_ips"], [{"ip": "10.0.0.1", "country": None, "asn": None}])

    def test_bounding_and_counts(self):
        """Verify lists are capped at 20 while true counts are recorded."""
        ts = datetime(2026, 8, 4, 21, 43, 0, tzinfo=timezone.utc)
        large_cp_list = [f"bc1qcounterparty{i}" for i in range(50)]
        large_alert_list = [
            {"alert_id": f"al_{i}", "type": "suspicious", "confidence": 0.9, "txid": f"tx_{i}"}
            for i in range(30)
        ]

        def handler(query, params):
            q = query.strip()
            if "OPTIONAL MATCH (a)-[s:SPENDS]->(t_in:Transaction)" in q:
                return MockResult({
                    "address": "bc1qbusy",
                    "risk_score": None,
                    "as_input": 10,
                    "as_output": 10,
                    "total_sent": 100000,
                    "total_received": 100000,
                    "in_tx_list": [{"txid": f"tx_in_{i}", "ts": ts} for i in range(10)],
                    "out_tx_list": [{"txid": f"tx_out_{i}", "ts": ts} for i in range(10)],
                })
            if "collect(cp) AS counterparties" in q:
                return MockResult({"counterparties": large_cp_list})
            if "item.ip AS ip" in q:
                return []
            if "clusters" in q:
                return MockResult({"clusters": []})
            if "collect({alert_id: alert_id" in q:
                return MockResult({"alerts": large_alert_list})
            return MockResult({})

        driver = MockDriver(handler)
        profile = get_entity_profile(driver, "CASE_2026_001", "bc1qbusy", "address")
        self.assertEqual(len(profile["counterparties"]), 20)
        self.assertEqual(profile["counterparty_count"], 50)
        self.assertEqual(len(profile["alerts"]), 20)
        self.assertEqual(profile["alert_count"], 30)

    def test_call_signature_flexibility(self):
        """Ensure get_entity_profile handles standard positional and keyword arguments correctly."""
        def handler(query, params):
            return MockResult(None)

        driver = MockDriver(handler)
        # 1. Standard positional: (driver, case_id, entity_id, entity_type)
        r1 = get_entity_profile(driver, "CASE_001", "bc1qtest", "address")
        self.assertEqual(r1["entity_id"], "bc1qtest")
        self.assertEqual(r1["case_id"], "CASE_001")
        self.assertEqual(r1["entity_type"], "address")

        # 2. Named keyword invocation
        r2 = get_entity_profile(driver, entity_id="192.0.2.1", entity_type="ip", case_id="CASE_002")
        self.assertEqual(r2["entity_id"], "192.0.2.1")
        self.assertEqual(r2["entity_type"], "ip")
        self.assertEqual(r2["case_id"], "CASE_002")

        # 3. LangGraph tool execution unpacked kwargs: fn(driver, case_id, **tool_args)
        args = {"entity_id": "bc1qtest", "entity_type": "address"}
        r3 = get_entity_profile(driver, "CASE_003", **args)
        self.assertEqual(r3["entity_id"], "bc1qtest")
        self.assertEqual(r3["case_id"], "CASE_003")
        self.assertEqual(r3["entity_type"], "address")

    def test_counterparty_directional_and_cluster_relationships(self):
        """Verify that counterparty query is strictly directional and cluster query uses CANDIDATE_MEMBER_OF."""
        executed_queries = []

        def handler(query, params):
            executed_queries.append(query)
            if "OPTIONAL MATCH (a)-[s:SPENDS]->(t_in:Transaction)" in query:
                return MockResult({
                    "address": "bc1qtest",
                    "risk_score": None,
                    "as_input": 1,
                    "as_output": 1,
                    "total_sent": 1000,
                    "total_received": 1000,
                    "in_tx_list": [{"txid": "tx1", "ts": "2026-03-01T00:00:00Z"}],
                    "out_tx_list": [{"txid": "tx2", "ts": "2026-03-02T00:00:00Z"}],
                })
            if "counterparties" in query:
                return MockResult({"counterparties": ["bc1qother"]})
            if "clusters" in query:
                return MockResult({"clusters": []})
            if "alerts" in query:
                return MockResult({"alerts": []})
            return []

        driver = MockDriver(handler)
        get_entity_profile(driver, "CASE_001", "bc1qtest", "address")

        # Verify counterparty query has directional constraints
        cp_queries = [q for q in executed_queries if "counterparties" in q]
        self.assertTrue(len(cp_queries) > 0)
        cp_q = cp_queries[0]
        self.assertIn("[:SPENDS]->(t_out:Transaction)-[:PAYS_TO]->", cp_q)
        self.assertIn("[:SPENDS]->(t_in:Transaction)-[:PAYS_TO]->(a)", cp_q)
        self.assertNotIn("-[:SPENDS|PAYS_TO]-(t:Transaction)-[:SPENDS|PAYS_TO]-", cp_q)

        # Verify cluster query uses CANDIDATE_MEMBER_OF
        cluster_queries = [q for q in executed_queries if "clusters" in q]
        self.assertTrue(len(cluster_queries) > 0)
        cl_q = cluster_queries[0]
        self.assertIn("CANDIDATE_MEMBER_OF", cl_q)
        self.assertNotIn("BELONGS_TO", cl_q)
        self.assertNotIn("IN_CLUSTER", cl_q)

    def test_intent_router_entity_profile(self):
        """Verify intent router matches profile and history queries."""
        m1 = route("profile bc1qcsvPEEL0100")
        self.assertIsNotNone(m1)
        self.assertEqual(m1[0], "get_entity_profile")
        self.assertEqual(m1[1], {"entity_id": "bc1qcsvPEEL0100", "entity_type": "address"})

        m2 = route("profile 192.0.2.194")
        self.assertIsNotNone(m2)
        self.assertEqual(m2[0], "get_entity_profile")
        self.assertEqual(m2[1], {"entity_id": "192.0.2.194", "entity_type": "ip"})

        m3 = route("history of bc1qcsvPEEL0100")
        self.assertIsNotNone(m3)
        self.assertEqual(m3[0], "get_entity_profile")
        self.assertEqual(m3[1], {"entity_id": "bc1qcsvPEEL0100", "entity_type": "address"})

    def test_format_reply_timeframe(self):
        """Verify reply phrasing for single occurrence vs multi-day activity."""
        single_occ = {
            "entity_id": "bc1qtest",
            "entity_type": "address",
            "transaction_count": 1,
            "role_breakdown": {"as_input": 1, "as_output": 0},
            "counterparty_count": 1,
            "first_seen": "2026-03-01T12:00:00Z",
            "last_seen": "2026-03-01T12:00:00Z",
            "known_since_days": 0,
            "alert_count": 0,
        }
        reply_single = _format_reply("get_entity_profile", single_occ)
        self.assertIn("Active on 2026-03-01T12:00:00Z (single occurrence).", reply_single)
        self.assertNotIn("(0 days)", reply_single)

        multi_day = {
            "entity_id": "bc1qtest",
            "entity_type": "address",
            "transaction_count": 3,
            "role_breakdown": {"as_input": 2, "as_output": 1},
            "counterparty_count": 2,
            "first_seen": "2026-03-01T12:00:00Z",
            "last_seen": "2026-03-05T12:00:00Z",
            "known_since_days": 4,
            "alert_count": 0,
        }
        reply_multi = _format_reply("get_entity_profile", multi_day)
        self.assertIn("Active 2026-03-01T12:00:00Z to 2026-03-05T12:00:00Z (4 days).", reply_multi)

        same_day = {
            "entity_id": "bc1qtest",
            "entity_type": "address",
            "transaction_count": 2,
            "role_breakdown": {"as_input": 1, "as_output": 1},
            "counterparty_count": 2,
            "first_seen": "2026-03-01T12:00:00Z",
            "last_seen": "2026-03-01T18:00:00Z",
            "known_since_days": 0,
            "alert_count": 0,
        }
        reply_same_day = _format_reply("get_entity_profile", same_day)
        self.assertIn("Active 2026-03-01T12:00:00Z to 2026-03-01T18:00:00Z (same day).", reply_same_day)
        self.assertNotIn("(0 days)", reply_same_day)

    def test_alert_deduplication_by_alert_id(self):
        """Verify that multiple transaction hops for the same alert_id are deduped into a single alert with linked_txids."""
        def handler(query, params):
            if "OPTIONAL MATCH (a)-[s:SPENDS]->(t_in:Transaction)" in query:
                return MockResult({
                    "address": "bc1qtest",
                    "risk_score": None,
                    "as_input": 1,
                    "as_output": 1,
                    "total_sent": 1000,
                    "total_received": 1000,
                    "in_tx_list": [{"txid": "tx1", "ts": "2026-03-01T00:00:00Z"}],
                    "out_tx_list": [{"txid": "tx2", "ts": "2026-03-01T01:00:00Z"}],
                })
            if "counterparties" in query:
                return MockResult({"counterparties": []})
            if "clusters" in query:
                return MockResult({"clusters": []})
            if "alerts" in query:
                return MockResult({
                    "alerts": [
                        {
                            "alert_id": "alert_peel_001",
                            "type": "peeling_chain",
                            "confidence": 0.9,
                            "txid": "tx1",
                            "linked_txids": ["tx1", "tx2"],
                        }
                    ]
                })
            return []

        driver = MockDriver(handler)
        profile = get_entity_profile(driver, "CASE_001", "bc1qtest", "address")
        self.assertEqual(profile["alert_count"], 1)
        self.assertEqual(len(profile["alerts"]), 1)
        self.assertEqual(profile["alerts"][0]["alert_id"], "alert_peel_001")
        self.assertEqual(profile["alerts"][0]["linked_txids"], ["tx1", "tx2"])


if __name__ == "__main__":
    unittest.main()
