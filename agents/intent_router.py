from __future__ import annotations

import re

# Deliberately simple, deliberately rehearsable: these patterns should
# cover every phrasing you plan to say in a live demo, so the agent
# never has to touch the LLM (and its latency/uncertainty) for the
# scripted parts of a walkthrough.

TXID_PATTERN = re.compile(r"tx_[a-zA-Z0-9_]+")
ADDRESS_PATTERN = re.compile(r"bc1[a-zA-Z0-9]+")
HOP_PATTERN = re.compile(r"(\d+)\s*hop")


def route(text: str) -> tuple[str, dict] | None:
    """Try to match user input to a known tool + args without calling
    the LLM. Returns None if nothing matches confidently — caller
    should fall back to the LLM router in that case, never guess."""
    lower = text.lower()
    txid_match = TXID_PATTERN.search(text)
    address_match = ADDRESS_PATTERN.search(text)

    if any(k in lower for k in ["why", "explain", "flagged", "reason"]):
        if txid_match:
            return "explain_alert", {"txid": txid_match.group()}
        return None  # "why was this flagged" with no txid is ambiguous — let LLM ask/handle

    if "coinjoin" in lower:
        return "list_patterns", {"pattern_type": "coinjoin_like"}
    if "peeling" in lower:
        return "list_patterns", {"pattern_type": "peeling_chain"}
    if "pattern" in lower or "alerts" in lower:
        return "list_patterns", {"pattern_type": "all"}

    if any(k in lower for k in ["graph", "expand", "subgraph", "fund flow", "fund-flow"]):
        center = txid_match.group() if txid_match else (address_match.group() if address_match else None)
        if center is None:
            return None
        hop_match = HOP_PATTERN.search(lower)
        hops = int(hop_match.group(1)) if hop_match else 1
        return "get_subgraph", {"center": center, "hops": hops}

    if any(k in lower for k in ["search", "find", "look up", "lookup"]):
        target = txid_match.group() if txid_match else (address_match.group() if address_match else None)
        if target is None:
            return None
        return "search_entity", {"query": target}

    return None