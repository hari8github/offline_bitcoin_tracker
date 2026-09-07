from __future__ import annotations

from typing import Optional, TypedDict

from langchain_ollama import ChatOllama
from langgraph.graph import END, StateGraph

from .intent_router import route
from .agent_schema import TOOL_SCHEMAS, AgentResponse
from .agent_tools import TOOL_FUNCTIONS

OLLAMA_MODEL = "llama3.2:3b"  # swap to "qwen2.5:7b-instruct" if tool-picking is unreliable

# Reverse lookup: bind_tools uses each Pydantic model's class name as
# the tool "name" the LLM sees, so we need to map that back to our
# internal tool keys (e.g. "ExplainAlertArgs" -> "explain_alert").
_SCHEMA_NAME_TO_TOOL = {schema.__name__: name for name, schema in TOOL_SCHEMAS.items()}

_UNSUPPORTED_REPLY = (
    "I can only search, show a fund-flow graph, list detected patterns, "
    "or explain why something was flagged — I couldn't match that request "
    "to one of those actions."
)


class AgentState(TypedDict, total=False):
    input: str
    case_id: Optional[str]
    tool_name: Optional[str]
    tool_args: Optional[dict]
    tool_result: Optional[dict]
    reply: str


def _format_reply(tool_name: str, result: dict) -> str:
    """Plain-language summary of a tool result. Templated, not a second
    LLM call — keeps latency low and means the wording is fully
    predictable for a live demo."""
    if tool_name == "explain_alert":
        if not result["found"]:
            return f"No alerts found for {result['txid']}."
        parts = []
        for a in result["alerts"]:
            parts.append(f"flagged as {a['type']} ({a['confidence'] * 100:.0f}% confidence)")
        return f"{result['txid']} was " + "; ".join(parts) + "."

    if tool_name == "list_patterns":
        n = len(result["results"])
        label = result["pattern_type"] if result["pattern_type"] != "all" else "pattern"
        if n == 0:
            return f"No {label} alerts found."
        top = result["results"][0]
        return f"Found {n} {label} alert(s). Highest confidence: {top['txid']} at {top['confidence'] * 100:.0f}%."

    if tool_name == "get_subgraph":
        return f"Retrieved a {result['hops']}-hop subgraph around {result['center']} — {result['node_count']} node(s)."

    if tool_name == "search_entity":
        if not result["found"]:
            return f"No match found for '{result['query']}'."
        kinds = [k for k, v in result["matched_as"].items() if v]
        return f"'{result['query']}' matched as: {', '.join(kinds)}."

    if tool_name == "get_entity_profile":
        if result.get("transaction_count", 0) == 0:
            return f"No transaction history found for {result.get('entity_type', 'entity')} {result.get('entity_id', '')} in this case."
        if result.get("entity_type") == "address":
            rb = result.get("role_breakdown") or {}
            alerts_str = f", {result.get('alert_count', 0)} alert(s)" if result.get("alert_count") else ", no alerts"
            return (
                f"Address {result.get('entity_id')}: {result.get('transaction_count')} tx(s) "
                f"({rb.get('as_input', 0)} in, {rb.get('as_output', 0)} out), "
                f"{result.get('counterparty_count', 0)} counterparty(ies){alerts_str}. "
                f"Active {result.get('first_seen')} to {result.get('last_seen')} ({result.get('known_since_days', 0)} days)."
            )
        else:
            alerts_str = f", {result.get('alert_count', 0)} alert(s)" if result.get("alert_count") else ", no alerts"
            return (
                f"IP {result.get('entity_id')}: {result.get('transaction_count')} tx(s) observed, "
                f"{result.get('address_count', 0)} communicating address(es){alerts_str}. "
                f"Active {result.get('first_seen')} to {result.get('last_seen')} ({result.get('known_since_days', 0)} days)."
            )

    return "Done."


def build_agent(driver):
    """Returns a compiled LangGraph agent bound to a live Neo4j driver.
    Driver is captured via closure rather than passed through state —
    keeps AgentState plain and serializable if checkpointing is added
    later."""

    def node_fast_path(state: AgentState) -> dict:
        matched = route(state["input"])
        if matched:
            tool_name, args = matched
            return {"tool_name": tool_name, "tool_args": args}
        return {}

    def node_llm_fallback(state: AgentState) -> dict:
        llm = ChatOllama(model=OLLAMA_MODEL, temperature=0)
        llm_with_tools = llm.bind_tools(list(TOOL_SCHEMAS.values()))
        response = llm_with_tools.invoke(state["input"])

        if not response.tool_calls:
            return {"reply": _UNSUPPORTED_REPLY}

        call = response.tool_calls[0]
        tool_name = _SCHEMA_NAME_TO_TOOL.get(call["name"])
        if tool_name is None:
            return {"reply": _UNSUPPORTED_REPLY}

        # Re-validate through our own schema even though the LLM already
        # "filled" it — never trust LLM output as pre-validated.
        schema_cls = TOOL_SCHEMAS[tool_name]
        try:
            validated = schema_cls(**call["args"])
        except Exception:
            return {"reply": _UNSUPPORTED_REPLY}

        return {"tool_name": tool_name, "tool_args": validated.model_dump()}

    def node_execute(state: AgentState) -> dict:
        fn = TOOL_FUNCTIONS[state["tool_name"]]
        result = fn(driver, state.get("case_id"), **state["tool_args"])
        return {"tool_result": result}

    def node_format_reply(state: AgentState) -> dict:
        return {"reply": _format_reply(state["tool_name"], state["tool_result"])}

    graph = StateGraph(AgentState)
    graph.add_node("fast_path", node_fast_path)
    graph.add_node("llm_fallback", node_llm_fallback)
    graph.add_node("execute", node_execute)
    graph.add_node("format_reply", node_format_reply)

    graph.set_entry_point("fast_path")
    graph.add_conditional_edges(
        "fast_path", lambda s: "execute" if s.get("tool_name") else "llm_fallback"
    )
    graph.add_conditional_edges(
        "llm_fallback", lambda s: "execute" if s.get("tool_name") else END
    )
    graph.add_edge("execute", "format_reply")
    graph.add_edge("format_reply", END)

    return graph.compile()


def run_agent(driver, case_id: str | None, user_input: str, compiled_graph=None) -> AgentResponse:
    """Convenience entry point — builds the graph if not given a
    pre-compiled one (pass a cached one in production to avoid
    rebuilding per request)."""
    graph = compiled_graph or build_agent(driver)
    result = graph.invoke({"input": user_input, "case_id": case_id})
    return AgentResponse(
        reply=result.get("reply", ""),
        tool=result.get("tool_name"),
        data=result.get("tool_result"),
    )