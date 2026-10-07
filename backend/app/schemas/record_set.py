from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import ChangeInfo

RecordType = Literal["A", "AAAA", "CNAME", "TXT", "MX", "NS", "PTR", "SRV", "CAA", "SOA"]
RoutingPolicy = Literal[
    "SIMPLE",
    "WEIGHTED",
    "LATENCY",
    "FAILOVER",
    "MULTIVALUE",
    "GEOLOCATION",
    "GEOPROXIMITY",
    "IP_BASED",
]
FailoverRole = Literal["PRIMARY", "SECONDARY"]


class AliasTarget(BaseModel):
    dns_name: str = Field(min_length=1, max_length=1024)
    hosted_zone_id: str = Field(min_length=1, max_length=64)
    evaluate_target_health: bool = False


class RecordSetFields(BaseModel):
    """Everything about a record set that can change after creation."""

    ttl: int | None = 300
    values: list[str] = []
    routing_policy: RoutingPolicy = "SIMPLE"
    set_identifier: str | None = None
    weight: int | None = None
    region: str | None = None
    failover: FailoverRole | None = None
    health_check_id: str | None = None
    alias: AliasTarget | None = None


class RecordSetCreate(RecordSetFields):
    # 'www', 'www.example.com' and 'www.example.com.' all mean the same record; '' or '@' = apex
    name: str = Field(default="", max_length=1024)
    type: RecordType


class RecordSetUpdate(RecordSetFields):
    """PUT body: name and type are fixed after creation, as in the console."""


class RecordSetOut(BaseModel):
    id: str
    zone_id: str
    name: str
    type: RecordType
    ttl: int | None
    values: list[str]
    routing_policy: RoutingPolicy
    set_identifier: str | None
    weight: int | None
    region: str | None
    failover: FailoverRole | None
    health_check_id: str | None
    alias: AliasTarget | None
    is_default: bool
    created_at: datetime
    updated_at: datetime


class RecordSetWriteResponse(BaseModel):
    record_set: RecordSetOut
    change: ChangeInfo
