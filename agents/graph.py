from __future__ import annotations

import json
from typing import Optional, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_ollama import ChatOllama
from langgraph.graph import END, StateGraph

from .intent_router import route, REFERENCE_WORDS, _ELABORATION_PATTERN
from .agent_schema import TOOL_SCHEMAS, AgentResponse, ConversationState
from .agent_tools import TOOL_FUNCTIONS

OLLAMA_MODEL = "llama3.2:3b"  # swap to "qwen2.5:7b-instruct" if tool-picking is unreliable

# Reverse lookup: bind_tools uses each Pydantic model's class name as
# the tool "name" the LLM sees, so we need to map that back to our
# internal tool keys (e.g. "ExplainAlertArgs" -> "explain_alert").
_SCHEMA_NAME_TO_TOOL = {schema.__name__: name for name, schema in TOOL_SCHEMAS.items()}

_UNSUPPORTED_REPLY = (
    "I can investigate transactions or entities, cross-reference similar transactions, "
    "search, show a fund-flow graph, list detected patterns, or explain alerts — "
    "I couldn't match that request to one of those actions."
)


class AgentState(TypedDict, total=False):
    input: str
    case_id: Optional[str]
    tool_name: Optional[str]
    tool_args: Optional[dict]
    tool_result: Optional[dict]
    reply: str
    # Session-level memory: what entity was last discussed in this conversation.
    last_entity_id: Optional[str]
    last_entity_kind: Optional[str]  # "transaction" | "address" | "ip"
    last_tool_name: Optional[str]
    last_tool_result: Optional[dict]
    surfaced_facts: list[str]
    turn_count: int
    # Legacy alias support
    last_entity: Optional[str]
    last_kind: Optional[str]
    last_tool: Optional[str]


def _format_transaction_narrative(txid: str, own_alerts: dict, similar: dict | None = None) -> str:
    alerts = own_alerts.get("alerts") or []
    if not alerts:
        base = f"Transaction {txid} has no triggered alerts in this case."
        if similar and similar.get("found"):
            cps = similar.get("shared_counterparty") or []
            ips = similar.get("shared_ip") or []
            prox = similar.get("amount_and_time_proximity") or []
            details = []
            if cps:
                details.append(f"shares counterparties with {len(cps)} transaction(s) ({', '.join(c['other_txid'] for c in cps[:3])})")
            if ips:
                details.append(f"shares IP {ips[0]['ip']} with {len(ips)} transaction(s)")
            if prox and not (cps or ips):
                details.append(f"shows amount/time proximity with {len(prox)} transaction(s) (within 24h, <=10% diff)")
            if details:
                return f"{base} However, it {'; '.join(details)}."
        return f"{base} No connected counterparties or similar transactions found."

    paragraphs = []
    for a in alerts:
        a_type = a.get("type", "")
        evidence = a.get("evidence") or {}

        if a_type == "coinjoin_like":
            in_count = evidence.get("input_count", 0)
            out_count = evidence.get("output_count", 0)
            out_amounts = evidence.get("output_amounts_sats") or []
            if out_amounts:
                avg_btc = (sum(out_amounts) / len(out_amounts)) / 1e8
                amount_clause = f", all near-identical amounts (~{avg_btc:.3f} BTC each)"
            else:
                amount_clause = ""

            counts_clause = f" — {in_count} inputs and {out_count} outputs{amount_clause}," if (in_count and out_count) else ""
            headline = f"{txid} is a CoinJoin-like transaction{counts_clause} which is designed to obscure which input paid which output."

            body_sentences = []
            if similar and similar.get("found"):
                cps = similar.get("shared_counterparty") or []
                if not cps:
                    body_sentences.append("This transaction shares no direct counterparties with other flagged transactions, which is expected for CoinJoin activity.")
                else:
                    body_sentences.append(f"It shares counterparties with {len(cps)} transaction(s) ({', '.join(c['other_txid'] for c in cps[:3])}).")

                # Peeling chain check
                same_alert_peel = [p for p in similar.get("same_pattern_type", []) if p.get("pattern_type") == "peeling_chain" and p.get("same_alert")]
                if not same_alert_peel:
                    body_sentences.append("It was NOT part of any peeling chain.")

                # Shared IP
                ips = similar.get("shared_ip") or []
                if ips:
                    body_sentences.append(f"Observed communicating via IP {ips[0]['ip']} (shared with {len(ips)} other transaction(s)).")

                # Other CoinJoins in case
                other_cj = [p for p in similar.get("same_pattern_type", []) if p.get("pattern_type") == "coinjoin_like"]
                if other_cj:
                    body_sentences.append(f"The case contains {len(other_cj)} other CoinJoin-like transaction(s) (e.g. {', '.join(p['other_txid'] for p in other_cj[:3])}).")

            if body_sentences:
                paragraphs.append(f"{headline} {' '.join(body_sentences)}")
            else:
                paragraphs.append(headline)

        elif a_type == "peeling_chain":
            path = evidence.get("path") or []
            chain_len = len(path)
            path_str = " → ".join(path)
            defining_clause = "where a large balance is broken into smaller payments while retaining most value as change at each step."

            if txid in path:
                hop_num = path.index(txid) + 1
                headline = f"{txid} is hop {hop_num} of a {chain_len}-transaction peeling chain ({path_str}), {defining_clause}"
            elif chain_len > 0:
                headline = f"{txid} is part of a {chain_len}-transaction peeling chain ({path_str}), {defining_clause}"
            else:
                headline = f"{txid} was flagged as a peeling chain ({a.get('confidence', 1.0) * 100:.0f}% confidence), {defining_clause}"

            body_sentences = []
            if similar and similar.get("found"):
                cps = similar.get("shared_counterparty") or []
                in_link = next((c for c in cps if c.get("relation") == "input_to_output"), None)
                out_link = next((c for c in cps if c.get("relation") == "output_to_input"), None)

                if in_link:
                    body_sentences.append(
                        f"It shares its input address with {in_link['other_txid']}'s output (via {in_link['shared_address']}) — that's the literal link forming the chain."
                    )
                if out_link:
                    body_sentences.append(
                        f"It passes peeling change to {out_link['other_txid']} via {out_link['shared_address']}."
                    )
                if not (in_link or out_link) and cps:
                    body_sentences.append(f"Connected to adjacent transactions via {len(cps)} shared counterparty relationship(s).")

                ips = similar.get("shared_ip") or []
                if ips:
                    body_sentences.append(
                        f"Shares source IP {ips[0]['ip']} with {len(ips)} other chain member(s) ({', '.join(i['other_txid'] for i in ips[:3])})."
                    )

                # Value sequence
                vals = evidence.get("value_sequence_sats") or []
                if len(vals) >= 2:
                    b_start = vals[0] / 1e8
                    b_end = vals[-1] / 1e8
                    body_sentences.append(f"Chain balance peeled from {b_start:.3f} BTC down to {b_end:.3f} BTC across steps.")

            if body_sentences:
                paragraphs.append(f"{headline} {' '.join(body_sentences)}")
            else:
                paragraphs.append(headline)

        else:
            conf_str = f" ({a.get('confidence', 1.0) * 100:.0f}% confidence)" if a.get("confidence") is not None else ""
            paragraphs.append(f"{txid} was flagged as {a_type}{conf_str}.")

    return "\n\n".join(paragraphs)


def _format_time_range(first_s: str | None, last_s: str | None, days: int) -> str:
    """Consolidated timestamp formatter ensuring same-day activity is always labeled
    '(same day)' rather than '(0 days)', preventing implementation drift."""
    if first_s and last_s and first_s == last_s:
        return f"Active on {first_s} (single occurrence)."
    elif first_s and last_s:
        if days == 0:
            return f"Active {first_s} to {last_s} (same day)."
        unit = "day" if days == 1 else "days"
        return f"Active {first_s} to {last_s} ({days} {unit})."
    elif first_s:
        return f"Active on {first_s}."
    return "No timestamp data."


def _format_compare_narrative(result: dict) -> str:
    """Produce a named-evidence comparison narrative. Every sentence states
    the specific field that created the connection. connected: False is phrased
    as a clean, confident negative — not an error or apology."""
    a = result.get("entity_a", "")
    b = result.get("entity_b", "")
    ka = result.get("kind_a", "entity")
    kb = result.get("kind_b", "entity")
    connected = result.get("connected", False)
    connections = result.get("connections") or {}

    if not connected:
        return (
            f"{a} ({ka}) and {b} ({kb}) share no directly traceable links in this case — "
            f"no common counterparties, IPs, clusters, or alert types."
        )

    parts = []

    # Address/IP vs Address/IP
    shared_cps = connections.get("shared_counterparties") or []
    if shared_cps:
        examples = ", ".join(shared_cps[:3])
        tail = f" (and {len(shared_cps) - 3} more)" if len(shared_cps) > 3 else ""
        parts.append(f"share {len(shared_cps)} common counterparty address(es): {examples}{tail}")

    shared_ips = connections.get("shared_ips") or []
    if shared_ips:
        parts.append(f"were both observed communicating via IP(s): {', '.join(shared_ips)}")

    shared_asns = connections.get("shared_asns") or []
    if shared_asns:
        parts.append(f"share ASN(s) {', '.join(shared_asns)} (broad network context — note ASN alone is not high-signal in this dataset)")

    shared_clusters = connections.get("shared_clusters") or []
    if shared_clusters:
        parts.append(f"are both candidate members of cluster(s): {', '.join(shared_clusters)}")

    shared_alert_types = connections.get("shared_alert_types") or []
    if shared_alert_types:
        parts.append(f"appear together in {', '.join(shared_alert_types)} alert(s)")

    # Transaction vs Transaction
    sim_links = connections.get("similarity_links") or []
    if sim_links:
        for link in sim_links:
            cat = link.get("category", "unknown")
            detail = link.get("detail") or {}
            if cat == "shared_counterparty":
                parts.append(
                    f"are linked via shared counterparty {detail.get('shared_address', '')} "
                    f"(relation: {detail.get('relation', '')})"
                )
            elif cat == "shared_ip":
                parts.append(f"share IP {detail.get('ip', '')} (role: {detail.get('role', '')})")
            elif cat == "same_pattern_type":
                same_flag = " — same alert" if detail.get("same_alert") else ""
                parts.append(f"share alert pattern '{detail.get('pattern_type', '')}'{same_flag}")
            elif cat == "amount_and_time_proximity":
                parts.append(
                    f"are within {detail.get('amount_diff_pct', '?')}% amount and "
                    f"{detail.get('time_diff_hours', '?')}h of each other"
                )
            else:
                parts.append(f"are connected via {cat}")

    # Mixed (tx + address/IP)
    direct_links = connections.get("direct_links") or []
    for dl in direct_links:
        dtype = dl.get("type", "")
        if dtype == "address_is_input":
            parts.append(f"{dl.get('address')} is a spending input address of {dl.get('txid')}")
        elif dtype == "address_is_output":
            parts.append(f"{dl.get('address')} is an output address of {dl.get('txid')}")
        elif dtype == "ip_on_transaction":
            parts.append(f"{dl.get('ip')} is the {dl.get('role', 'ip')} of transaction {dl.get('txid')}")

    if not parts:
        return (
            f"{a} and {b} are classified as connected (connection_count={result.get('connection_count')}), "
            f"but no specific link description is available."
        )

    connector = " and also ".join(parts) if len(parts) > 1 else parts[0]
    # direct_links parts start with an entity ID (e.g. "bc1q...", "192.0...", txid),
    # not a verb. Detect by checking if we actually have any direct_links.
    if direct_links and not sim_links and not shared_cps and not shared_ips and not shared_asns and not shared_clusters and not shared_alert_types:
        return f"{a} and {b} are directly connected: {connector}."
    return f"{a} and {b} are connected: they {connector}."


def _format_reply(tool_name: str, result: dict) -> str:
    """Plain-language summary of a tool result. Templated, not a second
    LLM call — keeps latency low and means the wording is fully
    predictable for a live demo."""
    if tool_name == "compare_entities":
        return _format_compare_narrative(result)

    if tool_name == "investigate":
        kind = result.get("kind")
        if kind == "transaction":
            return _format_transaction_narrative(
                result.get("id", ""),
                own_alerts=result.get("own_alerts") or {},
                similar=result.get("similar"),
            )

        if kind == "address":
            profile = result.get("profile") or {}
            if profile.get("transaction_count", 0) == 0:
                return f"No transaction history found for address {result.get('id')} in this case."

            rb = profile.get("role_breakdown") or {}
            alerts = profile.get("alerts") or []
            alert_count = profile.get("alert_count", len(alerts))
            if alert_count:
                alerts_str = f" Directly involved in {alert_count} alert finding(s) (e.g. {alerts[0].get('type', 'alert')})."
            else:
                alerts_str = " No associated alerts."

            clusters = profile.get("clusters") or []
            cluster_str = f" Candidate member of cluster {clusters[0].get('cluster_id')}." if clusters else ""

            time_str = _format_time_range(
                profile.get("first_seen"),
                profile.get("last_seen"),
                profile.get("known_since_days", 0),
            )

            return (
                f"Address {result.get('id')}: observed in {profile.get('transaction_count')} transaction(s) "
                f"({rb.get('as_input', 0)} in, {rb.get('as_output', 0)} out) across "
                f"{profile.get('counterparty_count', 0)} counterparty address(es).{alerts_str}{cluster_str} {time_str}"
            )

        if kind == "ip":
            profile = result.get("profile") or {}
            if profile.get("transaction_count", 0) == 0:
                return f"No transaction history found for IP {result.get('id')} in this case."

            alerts = profile.get("alerts") or []
            alert_count = profile.get("alert_count", len(alerts))
            alerts_str = f" Associated with {alert_count} alert finding(s)." if alert_count else " No associated alerts."

            time_str = _format_time_range(
                profile.get("first_seen"),
                profile.get("last_seen"),
                profile.get("known_since_days", 0),
            )

            return (
                f"IP {result.get('id')}: observed across {profile.get('transaction_count')} transaction(s) "
                f"communicating with {profile.get('address_count', 0)} address(es).{alerts_str} {time_str}"
            )

        return result.get("error", f"Could not investigate '{result.get('id')}'.")

    if tool_name == "explain_alert":
        if not result.get("found"):
            return f"No alerts found for {result.get('txid')}."
        return _format_transaction_narrative(result.get("txid", ""), own_alerts=result, similar=None)

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

        time_str = _format_time_range(
            result.get("first_seen"),
            result.get("last_seen"),
            result.get("known_since_days", 0),
        )

        if result.get("entity_type") == "address":
            rb = result.get("role_breakdown") or {}
            alerts_str = f", {result.get('alert_count', 0)} alert(s)" if result.get("alert_count") else ", no alerts"
            return (
                f"Address {result.get('entity_id')}: {result.get('transaction_count')} tx(s) "
                f"({rb.get('as_input', 0)} in, {rb.get('as_output', 0)} out), "
                f"{result.get('counterparty_count', 0)} counterparty(ies){alerts_str}. "
                f"{time_str}"
            )
        else:
            alerts_str = f", {result.get('alert_count', 0)} alert(s)" if result.get("alert_count") else ", no alerts"
            return (
                f"IP {result.get('entity_id')}: {result.get('transaction_count')} tx(s) observed, "
                f"{result.get('address_count', 0)} communicating address(es){alerts_str}. "
                f"{time_str}"
            )

    if tool_name == "find_similar_transactions":
        if not result.get("found"):
            return f"Transaction '{result.get('txid')}' not found in this case."

        parts = []
        cps = result.get("shared_counterparty") or []
        if cps:
            examples = [f"{c['other_txid']} ({c['relation']})" for c in cps[:3]]
            parts.append(f"{len(cps)} transaction(s) via shared counterparty: {', '.join(examples)}")

        ips = result.get("shared_ip") or []
        if ips:
            examples = [f"{i['other_txid']} ({i['ip']})" for i in ips[:3]]
            parts.append(f"{len(ips)} transaction(s) via shared IP: {', '.join(examples)}")

        pats = result.get("same_pattern_type") or []
        if pats:
            same_alert_txs = [p for p in pats if p.get("same_alert")]
            other_pattern_txs = [p for p in pats if not p.get("same_alert")]

            if same_alert_txs:
                chain_ex = [p["other_txid"] for p in same_alert_txs]
                parts.append(
                    f"{len(same_alert_txs)} transaction(s) in same alert/chain ({same_alert_txs[0]['pattern_type']}): {', '.join(chain_ex)}"
                )
            if other_pattern_txs:
                other_ex = [f"{p['other_txid']} ({p['pattern_type']})" for p in other_pattern_txs[:3]]
                parts.append(
                    f"{len(other_pattern_txs)} other transaction(s) of same general type: {', '.join(other_ex)}"
                )

        clusters = result.get("same_cluster") or []
        if clusters:
            parts.append(f"{len(clusters)} transaction(s) in same cluster")

        asns = result.get("shared_asn") or []
        asn_count = result.get("shared_asn_count", len(asns))
        if asns:
            if asn_count > len(asns):
                parts.append(
                    f"{asn_count} transaction(s) share ASN {asns[0].get('asn', '')} ({len(asns)} sampled — broad network context)"
                )
            else:
                parts.append(f"{asn_count} transaction(s) via shared ASN ({asns[0].get('asn', '')})")

        prox = result.get("amount_and_time_proximity") or []
        if prox:
            if not (cps or ips or pats or clusters):
                parts.append(f"Worth noting: {len(prox)} transaction(s) with similar amount & timing (within 24h, <=10% diff) e.g. {prox[0]['other_txid']} (±{prox[0]['amount_diff_pct']}%)")
            else:
                parts.append(f"{len(prox)} transaction(s) with amount & time proximity")

        if not parts:
            return f"Transaction {result.get('txid')}: No connected or similar transactions found."

        return f"Similar transactions for {result.get('txid')}:\n• " + "\n• ".join(parts)

    return "Done."


def _deterministic_elaboration_fallback(entity_id: str, kind: str, raw_data: dict, surfaced_facts: list[str]) -> str:
    """Safe, strictly factual extractor that surfaces an unmentioned category
    from verified raw_data if Ollama is unreachable, slow, or fails."""
    combined_surfaced = " ".join(surfaced_facts).lower()

    if kind == "transaction":
        similar = raw_data.get("similar") or {}
        # 1. Shared IP
        ips = similar.get("shared_ip") or []
        for ip_item in ips:
            ip_val = ip_item.get("ip")
            other_tx = ip_item.get("other_txid")
            if ip_val and ip_val.lower() not in combined_surfaced:
                role_str = f" ({ip_item.get('role')})" if ip_item.get("role") else ""
                return f"{entity_id} was observed communicating via IP {ip_val}{role_str}, shared with transaction {other_tx}."

        # 2. Shared ASN
        asns = similar.get("shared_asn") or []
        asn_count = similar.get("shared_asn_count", len(asns))
        if asns and str(asns[0].get("asn", "")).lower() not in combined_surfaced:
            asn_val = asns[0].get("asn")
            country = asns[0].get("country", "")
            c_str = f" in {country}" if country else ""
            ex_tx = asns[0].get("other_txid", "")
            return f"It shares ASN {asn_val}{c_str} with {asn_count} other transaction(s) in this case, including {ex_tx}."

        # 3. Same pattern transactions
        pats = similar.get("same_pattern_type") or []
        unmentioned_pats = [p for p in pats if p.get("other_txid", "").lower() not in combined_surfaced]
        if unmentioned_pats:
            ptype = unmentioned_pats[0].get("pattern_type", "alert")
            examples = ", ".join(p["other_txid"] for p in unmentioned_pats[:3])
            return f"The case contains {len(unmentioned_pats)} other transaction(s) sharing the {ptype} pattern, such as {examples}."

        # 4. Amount and time proximity
        prox = similar.get("amount_and_time_proximity") or []
        unmentioned_prox = [p for p in prox if p.get("other_txid", "").lower() not in combined_surfaced]
        if unmentioned_prox:
            p0 = unmentioned_prox[0]
            return f"It also exhibits amount and time proximity with {len(unmentioned_prox)} transaction(s), notably {p0.get('other_txid')} (diff {p0.get('amount_diff_pct')}% within {p0.get('time_diff_hours')}h)."

        # 5. Shared counterparty
        cps = similar.get("shared_counterparty") or []
        unmentioned_cps = [c for c in cps if c.get("other_txid", "").lower() not in combined_surfaced]
        if unmentioned_cps:
            c0 = unmentioned_cps[0]
            return f"It connects to {c0.get('other_txid')} via shared counterparty address {c0.get('shared_address')} (relation: {c0.get('relation')})."

    elif kind == "address":
        profile = raw_data.get("profile") or {}
        cps = profile.get("counterparties_sample") or []
        unmentioned_cps = [c for c in cps if c.lower() not in combined_surfaced]
        if unmentioned_cps:
            return f"Notable counterparties for address {entity_id} include {', '.join(unmentioned_cps[:3])}."
        clusters = profile.get("clusters") or []
        unmentioned_cl = [c for c in clusters if str(c.get("cluster_id")).lower() not in combined_surfaced]
        if unmentioned_cl:
            return f"Address {entity_id} is associated with cluster {unmentioned_cl[0].get('cluster_id')}."

    elif kind == "ip":
        profile = raw_data.get("profile") or {}
        addrs = profile.get("sample_addresses") or []
        unmentioned_addrs = [a for a in addrs if a.lower() not in combined_surfaced]
        if unmentioned_addrs:
            return f"IP {entity_id} was observed interacting with address(es): {', '.join(unmentioned_addrs[:3])}."

    kind_word = kind if kind in ("transaction", "address", "ip") else "entity"
    return f"That's everything I have on this {kind_word} in this dataset."


def build_agent(driver):
    """Returns a compiled LangGraph agent bound to a live Neo4j driver.
    Driver is captured via closure rather than passed through state —
    keeps AgentState plain and serializable."""

    def node_fast_path(state: AgentState) -> dict:
        entity = state.get("last_entity_id") or state.get("last_entity")
        kind   = state.get("last_entity_kind") or state.get("last_kind")
        ctx = {
            "last_entity_id": entity,
            "last_entity_kind": kind,
            "last_tool_name": state.get("last_tool_name") or state.get("last_tool"),
            "last_tool_result": state.get("last_tool_result"),
            "surfaced_facts": state.get("surfaced_facts") or [],
            "turn_count": state.get("turn_count", 0),
        } if entity else None

        matched = route(state["input"], context=ctx)
        if matched:
            tool_name, args = matched
            return {"tool_name": tool_name, "tool_args": args}
        return {}

    def node_llm_fallback(state: AgentState) -> dict:
        entity = state.get("last_entity_id") or state.get("last_entity")
        kind   = state.get("last_entity_kind") or state.get("last_kind")

        # Fast pronoun/elaboration fallback before calling LLM
        lower_in = state["input"].lower()
        if entity and (_ELABORATION_PATTERN.search(lower_in) or (REFERENCE_WORDS.search(lower_in) and any(k in lower_in for k in ["more", "else", "detail", "elaborate"]))):
            return {"tool_name": "elaborate", "tool_args": {"id": entity, "kind": kind}}

        llm = ChatOllama(model=OLLAMA_MODEL, temperature=0)
        llm_with_tools = llm.bind_tools(list(TOOL_SCHEMAS.values()))

        messages = []
        if entity:
            messages.append(SystemMessage(
                content=(
                    f"Current conversation context: The entity in focus is '{entity}' (type: {kind or 'unknown'}). "
                    f"If the user uses pronouns like 'this', 'that', 'it', or asks a follow-up without specifying an ID, "
                    f"resolve the entity to '{entity}'."
                )
            ))
        messages.append(HumanMessage(content=state["input"]))

        try:
            response = llm_with_tools.invoke(messages)
        except Exception:
            return {"reply": _UNSUPPORTED_REPLY}

        if not response.tool_calls:
            if entity and REFERENCE_WORDS.search(lower_in):
                return {"tool_name": "elaborate", "tool_args": {"id": entity, "kind": kind}}
            return {"reply": _UNSUPPORTED_REPLY}

        call = response.tool_calls[0]
        tool_name = _SCHEMA_NAME_TO_TOOL.get(call["name"])
        if tool_name is None:
            return {"reply": _UNSUPPORTED_REPLY}

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

    def node_elaborate(state: AgentState) -> dict:
        """Elaboration mode (Part C): surfaces facts from verified raw_data
        that have NOT yet been told to the user in this conversation."""
        entity_id = (
            state.get("tool_args", {}).get("id")
            or state.get("last_entity_id")
            or state.get("last_entity")
        )
        kind = (
            state.get("tool_args", {}).get("kind")
            or state.get("last_entity_kind")
            or state.get("last_kind")
        )

        raw_data = state.get("last_tool_result")
        # Ensure we have full composite data for elaboration
        if not raw_data or raw_data.get("id") != entity_id or ("similar" not in raw_data and "profile" not in raw_data):
            fn = TOOL_FUNCTIONS.get("investigate")
            if fn and entity_id:
                raw_data = fn(driver, state.get("case_id"), id=entity_id)
            else:
                raw_data = {}

        actual_kind = raw_data.get("kind") or kind or "entity"
        surfaced = list(state.get("surfaced_facts") or [])

        prompt = f"""You are a Bitcoin forensics assistant. The user is asking for more details or elaboration about {actual_kind} '{entity_id}'.

Here is the complete verified data retrieved for this entity from the investigation tools:
{json.dumps(raw_data, indent=2)}

The following information has ALREADY been told to the user in this conversation:
{json.dumps(surfaced, indent=2)}

INSTRUCTIONS:
1. Surface facts, relationships, or details directly present in the verified data that have NOT yet been told to the user (e.g. specific connected transaction IDs, shared source/destination IP addresses, ASN network context, alert patterns, or amount and timing proximity).
2. ONLY state facts directly present in the verified data above. Do not guess, assume, extrapolate, or hallucinate.
3. Formulate your response in natural, conversational, professional forensic language (1 to 3 sentences).
4. If there are no meaningful new facts or details left in the data to share that have not already been told, reply exactly:
"That's everything I have on this {actual_kind} in this dataset."
"""
        reply = None
        try:
            llm = ChatOllama(model=OLLAMA_MODEL, temperature=0.1)
            resp = llm.invoke(prompt)
            candidate = resp.content.strip()
            if candidate and not any(candidate.lower() == s.lower() for s in surfaced):
                reply = candidate
        except Exception:
            reply = None

        if not reply:
            reply = _deterministic_elaboration_fallback(entity_id, actual_kind, raw_data, surfaced)

        return {
            "reply": reply,
            "tool_result": raw_data,
            "tool_name": "investigate",
            "last_entity_id": entity_id,
            "last_entity_kind": actual_kind,
        }

    def node_format_reply(state: AgentState) -> dict:
        if state.get("reply"):
            return {"reply": state["reply"]}
        return {"reply": _format_reply(state["tool_name"], state["tool_result"])}

    def node_update_session(state: AgentState) -> dict:
        """Extract last_entity_id / last_entity_kind from the tool result,
        record the surfaced reply, and increment turn_count."""
        result = state.get("tool_result") or {}
        tool   = state.get("tool_name", "")
        reply  = state.get("reply", "")
        entity = None
        kind   = None

        if tool in ("investigate", "elaborate"):
            entity = result.get("id") or state.get("last_entity_id") or state.get("last_entity")
            kind   = result.get("kind") or state.get("last_entity_kind") or state.get("last_kind")
        elif tool == "explain_alert":
            entity = result.get("txid")
            kind   = "transaction"
        elif tool in ("find_similar_transactions",):
            entity = result.get("txid")
            kind   = "transaction"
        elif tool == "get_entity_profile":
            entity = result.get("entity_id")
            kind   = result.get("entity_type")
        elif tool == "compare_entities":
            entity = result.get("entity_a")
            kind   = result.get("kind_a")
        elif tool == "get_subgraph":
            entity = result.get("center")
            kind   = state.get("last_entity_kind") or state.get("last_kind")
        elif tool == "search_entity":
            entity = result.get("query")
            kind   = None

        prev_entity = state.get("last_entity_id") or state.get("last_entity")
        prev_surfaced = list(state.get("surfaced_facts") or [])

        # Reset surfaced_facts if entity changed, otherwise append
        if entity and prev_entity and entity != prev_entity:
            new_surfaced = [reply] if reply else []
        else:
            new_surfaced = list(prev_surfaced)
            if reply and reply not in new_surfaced and not reply.startswith("That's everything"):
                new_surfaced.append(reply)

        updates: dict = {
            "last_tool_name": tool,
            "last_tool": tool,
            "last_tool_result": result if result else state.get("last_tool_result"),
            "surfaced_facts": new_surfaced,
            "turn_count": (state.get("turn_count") or 0) + 1,
        }
        if entity:
            updates["last_entity_id"] = entity
            updates["last_entity"]    = entity
            updates["last_kind"]      = kind
            updates["last_entity_kind"] = kind
        return updates

    graph = StateGraph(AgentState)
    graph.add_node("fast_path",       node_fast_path)
    graph.add_node("llm_fallback",    node_llm_fallback)
    graph.add_node("execute",         node_execute)
    graph.add_node("elaborate",       node_elaborate)
    graph.add_node("format_reply",    node_format_reply)
    graph.add_node("update_session",  node_update_session)

    graph.set_entry_point("fast_path")

    def route_from_fast_path(s: AgentState) -> str:
        if s.get("tool_name") == "elaborate":
            return "elaborate"
        if s.get("tool_name"):
            return "execute"
        return "llm_fallback"

    def route_from_llm_fallback(s: AgentState) -> str:
        if s.get("tool_name") == "elaborate":
            return "elaborate"
        if s.get("tool_name"):
            return "execute"
        return END

    graph.add_conditional_edges("fast_path", route_from_fast_path)
    graph.add_conditional_edges("llm_fallback", route_from_llm_fallback)

    graph.add_edge("execute",        "format_reply")
    graph.add_edge("format_reply",   "update_session")
    graph.add_edge("elaborate",      "update_session")
    graph.add_edge("update_session", END)

    return graph.compile()


def run_agent(
    driver,
    case_id: str | None,
    user_input: str,
    compiled_graph=None,
    session_context: dict | ConversationState | None = None,
    session_state: ConversationState | dict | None = None,
) -> tuple[AgentResponse, ConversationState]:
    """Convenience entry point — builds the graph if not given a
    pre-compiled one.

    `session_context` or `session_state` seeds ConversationState so
    follow-up intents resolve against the previous turn.

    Returns (AgentResponse, ConversationState) — the caller (api.py)
    persists the updated state back to the session store.
    """
    graph = compiled_graph or build_agent(driver)
    seed: dict = {"input": user_input, "case_id": case_id}

    ctx = session_state if session_state is not None else session_context
    if ctx:
        if hasattr(ctx, "last_entity_id"):
            seed.update({
                "last_entity_id": ctx.last_entity_id,
                "last_entity_kind": ctx.last_entity_kind,
                "last_tool_name": ctx.last_tool_name,
                "last_tool_result": ctx.last_tool_result,
                "surfaced_facts": ctx.surfaced_facts,
                "turn_count": ctx.turn_count,
                "last_entity": ctx.last_entity_id,
                "last_kind": ctx.last_entity_kind,
                "last_tool": ctx.last_tool_name,
            })
        elif isinstance(ctx, dict):
            seed.update({
                "last_entity_id": ctx.get("last_entity_id") or ctx.get("last_entity"),
                "last_entity_kind": ctx.get("last_entity_kind") or ctx.get("last_kind"),
                "last_tool_name": ctx.get("last_tool_name") or ctx.get("last_tool"),
                "last_tool_result": ctx.get("last_tool_result"),
                "surfaced_facts": ctx.get("surfaced_facts") or [],
                "turn_count": ctx.get("turn_count", 0),
                "last_entity": ctx.get("last_entity_id") or ctx.get("last_entity"),
                "last_kind": ctx.get("last_entity_kind") or ctx.get("last_kind"),
                "last_tool": ctx.get("last_tool_name") or ctx.get("last_tool"),
            })

    result = graph.invoke(seed)

    updated_state = ConversationState(
        last_entity_id=result.get("last_entity_id") or result.get("last_entity"),
        last_entity_kind=result.get("last_entity_kind") or result.get("last_kind"),
        last_tool_name=result.get("last_tool_name") or result.get("last_tool"),
        last_tool_result=result.get("last_tool_result"),
        surfaced_facts=result.get("surfaced_facts") or [],
        turn_count=result.get("turn_count", 0),
    )

    return (
        AgentResponse(
            reply=result.get("reply", ""),
            tool=result.get("tool_name"),
            data=result.get("tool_result"),
        ),
        updated_state,
    )