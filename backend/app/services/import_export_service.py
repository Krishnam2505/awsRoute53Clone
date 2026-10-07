"""BIND zone-file import (with dry-run preview) and JSON / BIND export."""

import json

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import AppError
from app.models import HostedZone, RecordSet
from app.schemas.change import ChangeAction, ChangeBatchRequest
from app.schemas.common import ChangeInfo
from app.schemas.import_export import ImportLineError, ImportResult
from app.schemas.record_set import RecordSetCreate
from app.services import record_service as rs
from app.services.change_batch import apply_change_batch
from app.utils import bind
from app.utils.names import display_name


def import_zone_file(db: Session, zone: HostedZone, text: str, *, dry_run: bool) -> ImportResult:
    parsed = bind.parse_zone_file(text, zone.name)
    errors = [ImportLineError(line=line, message=message) for line, message in parsed.errors]

    record_sets: list[RecordSetCreate] = []
    for item in parsed.record_sets:
        candidate = RecordSetCreate(
            name=item.name,
            type=item.type,
            ttl=item.ttl,
            values=item.values,  # type: ignore[arg-type]
        )
        try:
            prepared = rs.prepare_record(zone, item.name, item.type, candidate)
            if rs.find_by_identity(db, zone, prepared.name, prepared.type, None) is not None:
                raise AppError(
                    "InvalidChangeBatch",
                    f"A {prepared.type} record for {display_name(prepared.name)} already exists "
                    "in this hosted zone",
                )
        except AppError as exc:
            errors.append(ImportLineError(line=item.line, message=exc.message))
            continue
        record_sets.append(
            candidate.model_copy(update={"name": prepared.name, "values": prepared.values})
        )

    errors.sort(key=lambda e: e.line)
    result = ImportResult(record_sets=record_sets, errors=errors, skipped=parsed.skipped)
    if dry_run or errors or not record_sets:
        return result

    batch = ChangeBatchRequest(
        comment="Imported from zone file",
        changes=[ChangeAction(action="CREATE", record_set=r) for r in record_sets],
    )
    change = apply_change_batch(db, zone, batch)
    result.change = ChangeInfo.model_validate(change)
    return result


def _all_records(db: Session, zone: HostedZone) -> list[RecordSet]:
    return list(
        db.scalars(
            select(RecordSet)
            .where(RecordSet.zone_id == zone.id)
            .options(selectinload(RecordSet.values))
            .order_by((RecordSet.name == zone.name).desc(), RecordSet.name, RecordSet.type)
        )
    )


def export_zone(db: Session, zone: HostedZone, fmt: str) -> tuple[str, str, str]:
    """Returns (body, media type, filename)."""
    records = _all_records(db, zone)
    base = display_name(zone.name)
    if fmt == "json":
        body = json.dumps(bind.to_route53_json(records), indent=2) + "\n"
        return body, "application/json", f"{base}.json"
    return bind.to_bind(zone.name, records), "text/plain", f"{base}.zone"
