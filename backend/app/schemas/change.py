from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.record_set import RecordSetCreate, RecordType


class RecordRef(BaseModel):
    """Identifies an existing record set for DELETE, either by ID or by identity."""

    id: str | None = None
    name: str | None = None
    type: RecordType | None = None
    set_identifier: str | None = None


class ChangeAction(BaseModel):
    action: Literal["CREATE", "UPSERT", "DELETE"]
    # Required for CREATE and UPSERT
    record_set: RecordSetCreate | None = None
    # DELETE may use either record_set (matched by name/type/set identifier) or record
    record: RecordRef | None = None


class ChangeBatchRequest(BaseModel):
    comment: str | None = Field(default=None, max_length=256)
    changes: list[ChangeAction] = Field(min_length=1, max_length=1000)
