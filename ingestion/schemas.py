from __future__ import annotations

from datetime import datetime
from ipaddress import ip_address
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class AddressAmount(BaseModel):
    """One (address, amount) pair. The common shape all three input
    formats (CSV, JSON, XML) get normalized into before validation."""

    address: str
    amount_sats: int

    @field_validator("address")
    @classmethod
    def address_non_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("address must be non-empty")
        return v

    @field_validator("amount_sats")
    @classmethod
    def amount_non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("amount must be non-negative")
        return v


class RawRecord(BaseModel):
    """Intermediate shape emitted by all three format-specific parsers.
    Amounts are still BTC floats here — satoshi conversion happens only
    in NormalizedTx, so parsers stay format-only concerns and validation
    logic is never duplicated per format."""

    txid: str
    timestamp: str
    src_ip: str
    dst_ip: str
    src_port: int
    dst_port: int
    inputs: list[dict]   # [{"address": str, "amount": float}, ...]
    outputs: list[dict]
    geo_country: str
    asn: int

    source_format: Literal["csv", "json", "xml"]
    source_file: str
    source_row: str  # e.g. "row_23" or "idx_7"


def btc_to_sats(amount_btc: float) -> int:
    """Single source of truth for BTC -> satoshi conversion. Rounds at
    the satoshi boundary so float drift can't compound across many
    inputs/outputs in one transaction (BTC floats are not exact at 8
    decimal places)."""
    return round(amount_btc * 1e8)


class NormalizedTx(BaseModel):
    """Fully validated, satoshi-denominated transaction record. This is
    what gets pushed to Neo4j. Display layers convert back to BTC
    (amount_sats / 1e8) at the edge — never internally."""

    txid: str
    timestamp: datetime
    src_ip: str
    dst_ip: str
    src_port: int
    dst_port: int
    inputs: list[AddressAmount]
    outputs: list[AddressAmount]
    geo_country: str
    asn: int

    total_input_sats: int = 0
    total_output_sats: int = 0
    implied_fee_sats: int = 0

    source_format: Literal["csv", "json", "xml"]
    source_file: str
    source_row: str

    @field_validator("src_ip", "dst_ip")
    @classmethod
    def valid_ip(cls, v: str) -> str:
        try:
            ip_address(v)
        except ValueError as exc:
            raise ValueError(f"invalid IP address: {v!r}") from exc
        return v

    @field_validator("src_port", "dst_port")
    @classmethod
    def valid_port(cls, v: int) -> int:
        if not (0 <= v <= 65535):
            raise ValueError(f"port out of range 0-65535: {v}")
        return v

    @field_validator("txid")
    @classmethod
    def txid_non_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("txid must be non-empty")
        return v

    @model_validator(mode="after")
    def compute_totals_and_check_counts(self) -> "NormalizedTx":
        if not self.inputs:
            raise ValueError("transaction must have at least one input")
        if not self.outputs:
            raise ValueError("transaction must have at least one output")

        self.total_input_sats = sum(i.amount_sats for i in self.inputs)
        self.total_output_sats = sum(o.amount_sats for o in self.outputs)
        self.implied_fee_sats = self.total_input_sats - self.total_output_sats

        if self.implied_fee_sats < 0:
            raise ValueError(
                f"implied fee is negative ({self.implied_fee_sats} sats): "
                f"outputs exceed inputs"
            )
        return self


class IngestResult(BaseModel):
    """One outcome per input record — the unit the rejection report is
    built from."""

    row_ref: str  # e.g. "invoices.csv:row_23"
    status: Literal["accepted", "rejected_invalid", "rejected_duplicate"]
    data: Optional[NormalizedTx] = None
    errors: list[str] = Field(default_factory=list)


class ImportReport(BaseModel):
    case_id: str
    import_id: str
    total_records: int
    accepted_count: int
    rejected_invalid_count: int
    rejected_duplicate_count: int
    results: list[IngestResult]