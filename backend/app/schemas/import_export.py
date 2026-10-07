from pydantic import BaseModel, Field

from app.schemas.common import ChangeInfo
from app.schemas.record_set import RecordSetCreate


class ImportRequest(BaseModel):
    zone_file: str = Field(min_length=1, max_length=1_000_000)


class ImportLineError(BaseModel):
    line: int
    message: str


class ImportResult(BaseModel):
    """Preview on dry_run=true; with dry_run=false the preview is committed as one change batch."""

    record_sets: list[RecordSetCreate]
    errors: list[ImportLineError]
    skipped: int
    change: ChangeInfo | None = None
