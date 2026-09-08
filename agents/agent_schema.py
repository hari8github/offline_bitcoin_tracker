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


class SimilarTransactionsArgs(BaseModel):
    """Args for: 'find similar transactions to X' / 'cross-reference tx_xxx'."""
    txid: str = Field(description="The transaction ID to find similar transactions for, e.g. tx_csv_0040")
    max_per_category: int = Field(default=10, ge=1, le=50, description="Max results per category")


class InvestigateArgs(BaseModel):
    """Primary investigation tool: investigate a transaction ID (e.g. 'tx_csv_0040'),
    Bitcoin address (e.g. 'bc1q...'), or IP address (e.g. '192.0.2.1') in the case."""
    id: str = Field(description="Transaction ID, Bitcoin address, or IP address to investigate")


class CompareEntitiesArgs(BaseModel):
    """Args for: 'compare X and Y' / 'are X and Y connected' / 'how does X relate to Y'."""
    entity_a: str = Field(description="First entity: txid, Bitcoin address, or IP address")
    entity_b: str = Field(description="Second entity: txid, Bitcoin address, or IP address")


# Registry used by both the fast-path router and the LLM fallback —
# single source of truth for "what tools exist," matches the doc's
# guardrail that the assistant may only call pre-approved named tools.
TOOL_SCHEMAS = {
    "investigate": InvestigateArgs,
    "compare_entities": CompareEntitiesArgs,
    "explain_alert": ExplainAlertArgs,
    "list_patterns": ListPatternsArgs,
    "get_subgraph": SubgraphArgs,
    "search_entity": SearchArgs,
    "get_entity_profile": EntityProfileArgs,
    "find_similar_transactions": SimilarTransactionsArgs,
}


class AgentResponse(BaseModel):
    reply: str
    tool: str | None = None
    data: dict | None = None


class ConversationState(BaseModel):
    """Server-side session state tracking what entity was discussed,
    its raw tool result data, surfaced facts, and turn count."""
    last_entity_id: str | None = None
    last_entity_kind: Literal["transaction", "address", "ip"] | None = None
    last_tool_name: str | None = None
    last_tool_result: dict | None = None   # full raw data, not the templated reply
    surfaced_facts: list[str] = Field(default_factory=list)
    turn_count: int = 0

    @property
    def last_entity(self) -> str | None:
        return self.last_entity_id

    @property
    def last_kind(self) -> str | None:
        return self.last_entity_kind

    @property
    def last_tool(self) -> str | None:
        return self.last_tool_name

    def get(self, key, default=None):
        if hasattr(self, key):
            val = getattr(self, key)
            return val if val is not None else default
        legacy_map = {
            "last_entity": "last_entity_id",
            "last_kind": "last_entity_kind",
            "last_tool": "last_tool_name",
        }
        if key in legacy_map:
            val = getattr(self, legacy_map[key], None)
            return val if val is not None else default
        return default

    def __getitem__(self, key):
        val = self.get(key)
        if val is None:
            raise KeyError(key)
        return val

    def values(self):
        return [self.last_entity_id, self.last_entity_kind, self.last_tool_name, self.last_tool_result]