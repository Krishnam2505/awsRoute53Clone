"""Route53's ChangeResourceRecordSets: an atomic batch of CREATE / UPSERT / DELETE.

The whole batch runs in one transaction. Each action goes through the same
validation and cross-record rules as a single create, against the state left
by the actions before it; the first failure rolls everything back.
"""

from typing import Any

from sqlalchemy.orm import Session

from app.core.errors import AppError, FieldErrorItem, invalid_change_batch
from app.models import Change, HostedZone, RecordSet
from app.schemas.change import ChangeAction, ChangeBatchRequest
from app.services import record_service as rs
from app.services.changes import record_change
from app.utils.names import InvalidNameError, normalize_record_name


def _locate_for_delete(
    db: Session, zone: HostedZone, action: ChangeAction, prefix: str
) -> RecordSet:
    if action.record is not None and action.record.id:
        row = db.get(RecordSet, action.record.id)
        if row is None or row.zone_id != zone.id:
            raise invalid_change_batch(
                f"[Tried to delete resource record set with ID '{action.record.id}' but it was "
                "not found]",
                field_errors=[FieldErrorItem(prefix + "record.id", "Record not found")],
            )
        return row

    ref = action.record_set or action.record
    if ref is None or ref.name is None or ref.type is None:
        raise invalid_change_batch(
            "A DELETE action needs the record ID, or its name and type.",
            field_errors=[FieldErrorItem(prefix + "record", "Identify the record to delete")],
        )
    try:
        name = normalize_record_name(ref.name, zone.name)
    except InvalidNameError as exc:
        raise invalid_change_batch(str(exc)) from None
    row = rs.find_by_identity(db, zone, name, ref.type, ref.set_identifier)
    if row is None:
        described = f"name='{name}', type='{ref.type}'"
        if ref.set_identifier:
            described += f", set-identifier='{ref.set_identifier}'"
        raise invalid_change_batch(
            f"[Tried to delete resource record set [{described}] but it was not found]"
        )
    return row


def _apply(db: Session, zone: HostedZone, index: int, action: ChangeAction) -> dict[str, Any]:
    prefix = f"changes[{index}]."
    if action.action == "DELETE":
        row = _locate_for_delete(db, zone, action, prefix)
        summary = {
            "action": "DELETE",
            "name": row.name,
            "type": row.type,
            "set_identifier": row.set_identifier,
        }
        rs.apply_delete(db, row)
        return summary

    if action.record_set is None:
        raise invalid_change_batch(
            f"A {action.action} action needs a record set.",
            field_errors=[FieldErrorItem(prefix + "record_set", "Missing record set")],
        )
    data = action.record_set
    existing = None
    if action.action == "UPSERT":
        try:
            fqdn = normalize_record_name(data.name, zone.name)
            existing = rs.find_by_identity(db, zone, fqdn, data.type, data.set_identifier)
        except InvalidNameError:
            existing = None  # prepare_record below reports the bad name

    allow_soa = existing is not None and existing.is_default and data.type == "SOA"
    record = rs.prepare_record(
        zone, data.name, data.type, data, prefix=prefix + "record_set.", allow_soa=allow_soa
    )
    if existing is not None:
        rs.check_conflicts(db, zone, record, exclude_id=existing.id)
        rs.apply_update(db, existing, record)
    else:
        rs.check_conflicts(db, zone, record)
        rs.apply_create(db, zone, record)
    return record.to_action(action.action)


def apply_change_batch(db: Session, zone: HostedZone, batch: ChangeBatchRequest) -> Change:
    applied: list[dict[str, Any]] = []
    try:
        for index, action in enumerate(batch.changes):
            try:
                applied.append(_apply(db, zone, index, action))
            except AppError as exc:
                # Route53 reports every batch failure as InvalidChangeBatch
                raise AppError(
                    "InvalidChangeBatch",
                    exc.message,
                    exc.status_code if exc.status_code != 404 else 400,
                    exc.field_errors,
                ) from None
        change = record_change(db, zone.id, applied, batch.comment)
        rs.touch_zone(zone)
        db.commit()
    except AppError:
        db.rollback()
        raise
    return change
