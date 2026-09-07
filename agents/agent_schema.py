from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ExplainAlertArgs(BaseModel):
    """Args for: 'why was this flagged' / 'explain tx_xxx'."""
    txid: str = Field(description="The transaction ID to explain, e.g. tx_csv_0040")


class ListPatternsArgs(BaseModel):
    """Args for: 'show peeling chains' / 'list coinjoin alerts'."""
    pattern_type: Literal["peeling_chain", "coinjoin_like", "all"] = "all"


class SubgraphArgs(BaseModel):
    """Args for: 'show me the graph around X' / 'expand 2 hops from Y'."""
    center: str = Field(description="Address or txid to center the subgraph on")
    hops: int = Field(default=1, ge=1, le=5, description="How many hops to expand, max 5")


class SearchArgs(BaseModel):
    """Args for: 'find address X' / 'search for tx_xxx'."""
    query: str = Field(description="Address, txid, IP, or entity name to search for")


class EntityProfileArgs(BaseModel):
    """Args for: 'investigate address X' / 'profile IP Y' / 'entity profile'."""
    entity_id: str = Field(description="Address (bc1q...) or IP value to profile")
    entity_type: Literal["address", "ip"] = Field(
        default="address",
        description="Type of entity: 'address' or 'ip'",
    )


# Registry used by both the fast-path router and the LLM fallback —
# single source of truth for "what tools exist," matches the doc's
# guardrail that the assistant may only call pre-approved named tools.
TOOL_SCHEMAS = {
    "explain_alert": ExplainAlertArgs,
    "list_patterns": ListPatternsArgs,
    "get_subgraph": SubgraphArgs,
    "search_entity": SearchArgs,
    "get_entity_profile": EntityProfileArgs,
}


class AgentResponse(BaseModel):
    reply: str
    tool: str | None = None
    data: dict | None = None