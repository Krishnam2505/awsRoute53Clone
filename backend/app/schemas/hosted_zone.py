from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import ChangeInfo

ZoneType = Literal["public", "private"]


class VPCIn(BaseModel):
    region: str = Field(min_length=1, max_length=64)
    vpc_id: str = Field(min_length=1, max_length=64)


class VPCOut(VPCIn):
    pass


class Tag(BaseModel):
    key: str = Field(min_length=1, max_length=128)
    value: str = Field(default="", max_length=256)


class HostedZoneCreate(BaseModel):
    name: str = Field(max_length=1024)
    description: str | None = None
    type: ZoneType = "public"
    vpcs: list[VPCIn] = []
    tags: list[Tag] = []


class HostedZoneUpdate(BaseModel):
    """Only what Route53 lets you change after creation. Omitted fields stay as they are."""

    description: str | None = None
    tags: list[Tag] | None = None
    vpcs: list[VPCIn] | None = None


class HostedZoneSummary(BaseModel):
    id: str
    name: str
    type: ZoneType
    created_by: str
    record_count: int
    description: str | None
    created_at: datetime


class HostedZoneDetail(HostedZoneSummary):
    caller_reference: str
    name_servers: list[str]
    tags: list[Tag]
    vpcs: list[VPCOut]
    updated_at: datetime


class HostedZoneWriteResponse(BaseModel):
    hosted_zone: HostedZoneDetail
    change: ChangeInfo
