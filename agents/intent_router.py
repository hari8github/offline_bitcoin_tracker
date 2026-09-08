from __future__ import annotations

import re
from typing import Any

# Deliberately simple, deliberately rehearsable: these patterns cover
# the predictable phrasings of live demos and walkthroughs, ensuring fast,
# deterministic resolution without LLM latency or non-determinism.

TXID_PATTERN    = re.compile(r"tx_[a-zA-Z0-9_]+")
ADDRESS_PATTERN = re.compile(r"bc1[a-zA-Z0-9]+")
IP_PATTERN      = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
HOP_PATTERN     = re.compile(r"(\d+)\s*hop")

# Pronouns and reference words indicating the user is referring to the
# entity in the active conversation context.
REFERENCE_WORDS = re.compile(
    r"\b(this|that|it|its|more|else|also|and|detail|details|elaborate|deeper|further|again|anything)\b",
    re.IGNORECASE,
)

# Follow-up phrases requesting elaboration / deeper details.
_ELABORATION_PATTERN = re.compile(
    r"\b(explain\s+(?:this\s+)?more|tell\s+me\s+more|more\s+detail[s]?|what\s+else|"
    r"elaborate|go\s+deeper|deeper\s+dive|dig\s+deeper|details|anything\s+else|"
    r"expand|more\s+info|explain\s+further)\b",
    re.IGNORECASE,
)

# Follow-up phrases requesting graph visualization.
_FOLLOWUP_GRAPH = re.compile(
    r"\b(show\s+(?:me\s+)?(?:the\s+)?graph|open\s+(?:in\s+)?graph|"
    r"visuali[sz]e)\b",
    re.IGNORECASE,
)


def classify_id(val: str) -> str | None:
    """Helper to detect kind of an entity ID."""
    if TXID_PATTERN.match(val):
        return "transaction"
    if ADDRESS_PATTERN.match(val):
        return "address"
    if IP_PATTERN.match(val):
        return "ip"
    return None


def route(text: str, context: Any = None) -> tuple[str, dict] | None:
    """Try to match user input to a known tool + args without calling
    the LLM. Returns None if nothing matches confidently — caller
    should fall back to the LLM router in that case, never guess.

    `context` is the session state (ConversationState or dict):
    {last_entity_id, last_entity_kind, ...}.
    When present and the query uses reference words ('this', 'that', 'more', etc.),
    it resolves pronouns to last_entity_id.
    """
    lower = text.lower()
    txid_match    = TXID_PATTERN.search(text)
    address_match = ADDRESS_PATTERN.search(text)
    ip_match      = IP_PATTERN.search(text)
    explicit_id   = (
        txid_match.group()    if txid_match    else
        address_match.group() if address_match else
        ip_match.group()      if ip_match      else None
    )

    # Extract session context
    last_entity = None
    last_kind = None
    if context:
        if hasattr(context, "last_entity_id"):
            last_entity = context.last_entity_id
            last_kind = context.last_entity_kind
        elif isinstance(context, dict):
            last_entity = context.get("last_entity_id") or context.get("last_entity")
            last_kind = context.get("last_entity_kind") or context.get("last_kind")

    has_ref = bool(REFERENCE_WORDS.search(text))

    # Determine effective target entity and kind
    if explicit_id:
        target_id = explicit_id
        target_kind = (
            "transaction" if txid_match else
            "address"     if address_match else
            "ip"          if ip_match else None
        )
    elif has_ref and last_entity:
        target_id = last_entity
        target_kind = last_kind or classify_id(last_entity)
    else:
        target_id = None
        target_kind = None

    # ── 0. Elaboration intent (Part C) ────────────────────────────────────────
    if _ELABORATION_PATTERN.search(lower) and target_id:
        return "elaborate", {"id": target_id, "kind": target_kind}

    # ── 1. Follow-up graph intent ─────────────────────────────────────────────
    if _FOLLOWUP_GRAPH.search(lower) and target_id:
        hop_match = HOP_PATTERN.search(lower)
        hops = int(hop_match.group(1)) if hop_match else 1
        return "get_subgraph", {"center": target_id, "hops": hops}

    # ── 2. Compare two entities intent ────────────────────────────────────────
    if any(k in lower for k in ["compare", "connected", "relate", "link between",
                                 "difference between", "vs"]):
        txids     = TXID_PATTERN.findall(text)
        addresses = ADDRESS_PATTERN.findall(text)
        ips       = IP_PATTERN.findall(text)
        all_ids   = txids + addresses + ips
        if len(all_ids) >= 2:
            return "compare_entities", {"entity_a": all_ids[0], "entity_b": all_ids[1]}
        elif len(all_ids) == 1 and last_entity and has_ref and all_ids[0] != last_entity:
            return "compare_entities", {"entity_a": last_entity, "entity_b": all_ids[0]}

    # ── 3. Entity profile intent specifically ─────────────────────────────────
    if any(k in lower for k in ["profile", "history of", "who is", "entity profile"]):
        if target_id:
            if target_kind == "ip" or IP_PATTERN.search(target_id):
                return "get_entity_profile", {"entity_id": target_id, "entity_type": "ip"}
            else:
                return "get_entity_profile", {"entity_id": target_id, "entity_type": "address"}

    # ── 4. Similar transactions / cross-reference intent ──────────────────────
    if any(k in lower for k in ["similar", "cross-reference", "cross reference",
                                 "related to tx", "connected to tx", "like tx"]):
        if target_id and (target_kind == "transaction" or TXID_PATTERN.search(target_id)):
            return "find_similar_transactions", {"txid": target_id}

    # ── 5. Explain alert / why was it flagged ─────────────────────────────────
    if any(k in lower for k in ["why", "explain", "flagged", "reason"]):
        if target_id:
            if target_kind == "transaction" or TXID_PATTERN.search(target_id):
                return "explain_alert", {"txid": target_id}
            else:
                return "investigate", {"id": target_id}

    # ── 6. Detection pattern lists ────────────────────────────────────────────
    if "coinjoin" in lower:
        return "list_patterns", {"pattern_type": "coinjoin_like"}
    if "peeling" in lower:
        return "list_patterns", {"pattern_type": "peeling_chain"}
    if "pattern" in lower or "alerts" in lower:
        return "list_patterns", {"pattern_type": "all"}

    # ── 7. Graph / Subgraph intent ────────────────────────────────────────────
    if any(k in lower for k in ["graph", "expand", "subgraph", "fund flow", "fund-flow"]):
        if target_id:
            hop_match = HOP_PATTERN.search(lower)
            hops = int(hop_match.group(1)) if hop_match else 1
            return "get_subgraph", {"center": target_id, "hops": hops}

    # ── 8. Search intent ──────────────────────────────────────────────────────
    if any(k in lower for k in ["search", "find", "look up", "lookup"]):
        if explicit_id:
            return "search_entity", {"query": explicit_id}

    # ── 9. Primary investigate / generic catch-all intent ─────────────────────
    if any(k in lower for k in ["investigate", "tell me about", "what do you know about",
                                 "look into", "analyze", "check out", "what about", "and this", "and that"]):
        if target_id:
            return "investigate", {"id": target_id}

    # ── 10. Direct ID catch-all ───────────────────────────────────────────────
    if explicit_id and (any(k in lower for k in ["what is", "about", "details on", "status of"])
                        or len(text.strip().split()) <= 2):
        return "investigate", {"id": explicit_id}

    return None