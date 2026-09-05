from __future__ import annotations

from config import get_neo4j_driver, DEFAULT_CASE_ID
from agents.graph import build_agent, run_agent

CASE_ID = DEFAULT_CASE_ID

with get_neo4j_driver() as driver:
    driver.verify_connectivity()
    print(f"[+] Connected to Neo4j  |  Case: {CASE_ID}\n")

    # Pre-compile the graph once — reused across all three test calls
    compiled = build_agent(driver)

    # ── Test 1: fast-path (keyword match, no LLM) ──────────────
    r1 = run_agent(driver, case_id=CASE_ID,
                   user_input="show peeling chains",
                   compiled_graph=compiled)
    print("=== Test 1: show peeling chains ===")
    print("reply:", r1.reply)
    print("tool: ", r1.tool)
    print()

    # ── Test 2: fast-path (why + txid → explain_alert) ─────────
    r2 = run_agent(driver, case_id=CASE_ID,
                   user_input="why is tx_csv_0040 suspicious",
                   compiled_graph=compiled)
    print("=== Test 2: explain tx_csv_0040 ===")
    print("reply:", r2.reply)
    print("tool: ", r2.tool)
    print()

    # ── Test 3: LLM fallback (no keyword match) ─────────────────
    r3 = run_agent(driver, case_id=CASE_ID,
                   user_input="can you tell me if anything weird happened with that big transaction",
                   compiled_graph=compiled)
    print("=== Test 3: LLM fallback ===")
    print("reply:", r3.reply)
    print("tool: ", r3.tool)