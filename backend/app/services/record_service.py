"""Business rules for record sets.

Routes never touch the ORM directly: they call prepare_record() to normalise
and validate input, check_conflicts() for the cross-record rules, and the
apply_* helpers to write. The change-batch service reuses the same pieces so a
batch obeys exactly the same rules as a single create.
"""

from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import Select, and_, exists, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.errors import (
    AppError,
    FieldErrorItem,
    invalid_change_batch,
    invalid_input,
    no_such_record_set,
)
from app.models import Change, HostedZone, RecordSet, RecordValue
from app.models._common import utcnow
from app.schemas.record_set import (
    AliasTarget,
    RecordSetCreate,
    RecordSetFields,
    RecordSetOut,
    RecordSetUpdate,
)
from app.services.changes import record_change
from app.utils.ids import new_record_id
from app.utils.names import InvalidNameError, is_valid_hostname, normalize_record_name
from app.utils.regions import AWS_REGIONS
from app.validators import RecordValuesError, validate_values

MAX_TTL = 2147483647
SUPPORTED_POLICIES = ("SIMPLE", "WEIGHTED", "LATENCY", "FAILOVER", "MULTIVALUE")
ALIAS_TYPES = ("A", "AAAA", "CNAME", "TXT", "MX", "PTR", "SRV", "CAA")
POLICY_LABELS = {
    "SIMPLE": "simple",
    "WEIGHTED": "weighted",
    "LATENCY": "latency",
    "FAILOVER": "failover",
    "MULTIVALUE": "multivalue answer",
}


@dataclass
class PreparedRecord:
    """A validated, normalised record set ready to be written."""

    name: str
    type: str
    ttl: int | None
    values: list[str]
    routing_policy: str = "SIMPLE"
    set_identifier: str | None = None
    weight: int | None = None
    region: str | None = None
    failover: str | None = None
    health_check_id: str | None = None
    alias_dns_name: str | None = None
    alias_zone_id: str | None = None
    alias_evaluate_health: bool | None = None
    errors: list[FieldErrorItem] = field(default_factory=list)

    def describe(self) -> str:
        """Route53's way of naming a record set in error messages."""
        text = f"name='{self.name}', type='{self.type}'"
        if self.set_identifier is not None:
            text += f", set-identifier='{self.set_identifier}'"
        return text

    def to_action(self, action: str) -> dict[str, Any]:
        return {
            "action": action,
            "name": self.name,
            "type": self.type,
            "set_identifier": self.set_identifier,
            "ttl": self.ttl,
            "values": self.values,
            "alias_dns_name": self.alias_dns_name,
        }


# ---------------------------------------------------------------- reading


def to_schema(record: RecordSet) -> RecordSetOut:
    alias = None
    if record.alias_dns_name is not None:
        alias = AliasTarget(
            dns_name=record.alias_dns_name,
            hosted_zone_id=record.alias_zone_id or "",
            evaluate_target_health=bool(record.alias_evaluate_health),
        )
    return RecordSetOut(
        id=record.id,
        zone_id=record.zone_id,
        name=record.name,
        type=record.type,  # type: ignore[arg-type]
        ttl=record.ttl,
        values=[v.value for v in record.values],
        routing_policy=record.routing_policy,  # type: ignore[arg-type]
        set_identifier=record.set_identifier,
        weight=record.weight,
        region=record.region,
        failover=record.failover,  # type: ignore[arg-type]
        health_check_id=record.health_check_id,
        alias=alias,
        is_default=record.is_default,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def _escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


_SORT_COLUMNS = {
    "name": RecordSet.name,
    "type": RecordSet.type,
    "ttl": RecordSet.ttl,
    "routing_policy": RecordSet.routing_policy,
    "created_at": RecordSet.created_at,
}


def _filtered(
    zone: HostedZone, search: str | None, record_type: str | None, routing_policy: str | None
) -> Select[tuple[RecordSet]]:
    query = select(RecordSet).where(RecordSet.zone_id == zone.id)
    if record_type:
        query = query.where(RecordSet.type == record_type.upper())
    if routing_policy:
        query = query.where(RecordSet.routing_policy == routing_policy.upper())
    if search and search.strip():
        pattern = f"%{_escape_like(search.strip().lower())}%"
        value_match = exists().where(
            and_(
                RecordValue.record_set_id == RecordSet.id,
                func.lower(RecordValue.value).like(pattern, escape="\\"),
            )
        )
        query = query.where(
            or_(
                RecordSet.name.like(pattern, escape="\\"),
                func.lower(RecordSet.alias_dns_name).like(pattern, escape="\\"),
                func.lower(RecordSet.set_identifier).like(pattern, escape="\\"),
                value_match,
            )
        )
    return query


def list_records(
    db: Session,
    zone: HostedZone,
    *,
    search: str | None = None,
    record_type: str | None = None,
    routing_policy: str | None = None,
    page: int = 1,
    page_size: int = 50,
    sort: str | None = None,
    order: str = "asc",
) -> tuple[list[RecordSet], int]:
    """Search and pagination run in SQL, so this stays honest with thousands of rows."""
    query = _filtered(zone, search, record_type, routing_policy)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0

    if sort in _SORT_COLUMNS:
        column = _SORT_COLUMNS[sort]
        ordering = [column.desc() if order == "desc" else column.asc(), RecordSet.name]
    else:
        # Console default: the apex first, then by name and type
        ordering = [(RecordSet.name == zone.name).desc(), RecordSet.name, RecordSet.type]
    ordering.append(func.ifnull(RecordSet.set_identifier, ""))

    rows = db.scalars(
        query.options(selectinload(RecordSet.values))
        .order_by(*ordering)
        .limit(page_size)
        .offset((page - 1) * page_size)
    ).all()
    return list(rows), total


def get_record(db: Session, zone: HostedZone, record_id: str) -> RecordSet:
    record = db.scalar(
        select(RecordSet)
        .where(RecordSet.id == record_id, RecordSet.zone_id == zone.id)
        .options(selectinload(RecordSet.values))
    )
    if record is None:
        raise no_such_record_set(record_id)
    return record


def find_by_identity(
    db: Session, zone: HostedZone, name: str, record_type: str, set_identifier: str | None
) -> RecordSet | None:
    return db.scalar(
        select(RecordSet).where(
            RecordSet.zone_id == zone.id,
            RecordSet.name == name,
            RecordSet.type == record_type,
            func.ifnull(RecordSet.set_identifier, "") == (set_identifier or ""),
        )
    )


def count_records(db: Session, zone_id: str, *, non_default_only: bool = False) -> int:
    query = select(func.count(RecordSet.id)).where(RecordSet.zone_id == zone_id)
    if non_default_only:
        query = query.where(RecordSet.is_default.is_(False))
    return db.scalar(query) or 0


# ---------------------------------------------------------------- validation


def _clean(text: str | None) -> str | None:
    if text is None:
        return None
    stripped = text.strip()
    return stripped or None


def prepare_record(
    zone: HostedZone,
    name: str,
    record_type: str,
    data: RecordSetFields,
    *,
    prefix: str = "",
    allow_soa: bool = False,
) -> PreparedRecord:
    """Normalise and validate one record set. Raises InvalidInput listing every bad field."""
    errors: list[FieldErrorItem] = []

    def error(field_name: str, message: str) -> None:
        errors.append(FieldErrorItem(prefix + field_name, message))

    try:
        fqdn = normalize_record_name(name, zone.name)
    except InvalidNameError as exc:
        fqdn = name
        error("name", str(exc))

    if record_type == "SOA" and not allow_soa:
        error("type", "Route 53 creates the SOA record for you. You can edit it but not add one.")

    record = PreparedRecord(name=fqdn, type=record_type, ttl=data.ttl, values=[])
    policy = data.routing_policy
    record.routing_policy = policy

    # --- alias or plain values
    if data.alias is not None:
        if record_type not in ALIAS_TYPES:
            error("alias", f"You can't create an alias record of type {record_type}.")
        target = data.alias.dns_name.strip().lower()
        if not target.endswith("."):
            target += "."
        if not is_valid_hostname(target):
            error("alias.dns_name", "Enter a valid DNS name for the alias target.")
        if target == fqdn and data.alias.hosted_zone_id == zone.id:
            error("alias.dns_name", "An alias record can't route traffic to itself.")
        if policy == "MULTIVALUE":
            error("routing_policy", "Multivalue answer routing doesn't support alias records.")
        record.alias_dns_name = target
        record.alias_zone_id = data.alias.hosted_zone_id.strip()
        record.alias_evaluate_health = data.alias.evaluate_target_health
        record.ttl = None  # alias records carry no TTL
    else:
        if data.ttl is None:
            error("ttl", "Enter a TTL.")
        elif not 0 <= data.ttl <= MAX_TTL:
            error("ttl", f"TTL must be between 0 and {MAX_TTL} seconds.")
        try:
            record.values = validate_values(record_type, data.values)
        except RecordValuesError as exc:
            for issue in exc.errors:
                where = "values" if issue.index < 0 else f"values[{issue.index}]"
                error(where, issue.message)

    # --- routing policy
    if policy not in SUPPORTED_POLICIES:
        error("routing_policy", "This routing policy isn't available in this console yet.")
    elif policy == "SIMPLE":
        pass  # simple routing ignores every differentiator field
    else:
        set_id = _clean(data.set_identifier)
        if set_id is None:
            error("set_identifier", "Enter a record ID. It must be unique for this record name.")
        elif len(set_id) > 128:
            error("set_identifier", "The record ID can have a maximum of 128 characters.")
        record.set_identifier = set_id
        record.health_check_id = _clean(data.health_check_id)

        if policy == "WEIGHTED":
            if data.weight is None or not 0 <= data.weight <= 255:
                error("weight", "Weight must be an integer between 0 and 255.")
            record.weight = data.weight
        elif policy == "LATENCY":
            if data.region not in AWS_REGIONS:
                error("region", "Choose a Region.")
            record.region = data.region
        elif policy == "FAILOVER":
            if data.failover not in ("PRIMARY", "SECONDARY"):
                error("failover", "Choose Primary or Secondary.")
            record.failover = data.failover
        elif policy == "MULTIVALUE" and record_type == "CNAME":
            error("type", "Multivalue answer routing doesn't support CNAME records.")

    if errors:
        raise invalid_input(errors[0].message, errors)
    return record


def check_conflicts(
    db: Session, zone: HostedZone, record: PreparedRecord, *, exclude_id: str | None = None
) -> None:
    """Route53's cross-record rules."""
    zone_label = zone.name
    if record.type == "CNAME" and record.name == zone.name:
        raise invalid_change_batch(
            f"RRSet of type CNAME with DNS name {record.name} is not permitted at apex in "
            f"zone {zone_label}"
        )

    query = select(RecordSet).where(RecordSet.zone_id == zone.id, RecordSet.name == record.name)
    if exclude_id is not None:
        query = query.where(RecordSet.id != exclude_id)
    siblings = list(db.scalars(query))

    if record.type == "CNAME" and any(s.type != "CNAME" for s in siblings):
        raise invalid_change_batch(
            f"RRSet of type CNAME with DNS name {record.name} is not permitted as it conflicts "
            f"with other records with the same DNS name in zone {zone_label}"
        )
    if record.type != "CNAME" and any(s.type == "CNAME" for s in siblings):
        raise invalid_change_batch(
            f"RRSet of type {record.type} with DNS name {record.name} is not permitted because "
            f"a conflicting RRSet of type CNAME with the same DNS name already exists in zone "
            f"{zone_label}"
        )

    same_type = [s for s in siblings if s.type == record.type]
    if any((s.set_identifier or "") == (record.set_identifier or "") for s in same_type):
        raise invalid_change_batch(
            f"[Tried to create resource record set [{record.describe()}] but it already exists]",
            status_code=409,
        )
    if same_type and record.routing_policy == "SIMPLE":
        raise invalid_change_batch(
            f"RRSet with DNS name {record.name}, type {record.type} cannot be created because "
            "other record sets with the same name and type already exist. Simple routing "
            "allows only one record set per name and type."
        )
    other_policies = {s.routing_policy for s in same_type} - {record.routing_policy}
    if other_policies:
        existing = POLICY_LABELS.get(sorted(other_policies)[0], "different")
        raise invalid_change_batch(
            f"RRSet with DNS name {record.name}, type {record.type} and SetIdentifier "
            f"{record.set_identifier} cannot be created because a {existing} record set "
            "exists with the same name and type."
        )
    if record.routing_policy == "FAILOVER" and any(
        s.failover == record.failover for s in same_type
    ):
        raise invalid_change_batch(
            f"A {record.failover and record.failover.lower()} failover record already exists for "
            f"{record.name}, type {record.type}."
        )


# ---------------------------------------------------------------- writing


def _assign(target: RecordSet, record: PreparedRecord) -> None:
    target.ttl = record.ttl
    target.routing_policy = record.routing_policy
    target.set_identifier = record.set_identifier
    target.weight = record.weight
    target.region = record.region
    target.failover = record.failover
    target.health_check_id = record.health_check_id
    target.alias_dns_name = record.alias_dns_name
    target.alias_zone_id = record.alias_zone_id
    target.alias_evaluate_health = record.alias_evaluate_health
    target.values = [
        RecordValue(position=position, value=value) for position, value in enumerate(record.values)
    ]


def apply_create(
    db: Session, zone: HostedZone, record: PreparedRecord, *, is_default: bool = False
) -> RecordSet:
    row = RecordSet(
        id=new_record_id(),
        zone_id=zone.id,
        name=record.name,
        type=record.type,
        is_default=is_default,
    )
    _assign(row, record)
    db.add(row)
    _flush(db, record)
    return row


def apply_update(db: Session, row: RecordSet, record: PreparedRecord) -> RecordSet:
    # Replace the value rows: clear first so (record_set_id, position) can be reused
    row.values.clear()
    db.flush()
    _assign(row, record)
    _flush(db, record)
    return row


def ensure_deletable(row: RecordSet) -> None:
    if row.is_default and row.type == "SOA":
        raise invalid_change_batch("A HostedZone must contain exactly one SOA record.")
    if row.is_default and row.type == "NS":
        raise invalid_change_batch(
            "A HostedZone must contain at least one NS record for the zone itself."
        )


def apply_delete(db: Session, row: RecordSet) -> None:
    ensure_deletable(row)
    db.delete(row)
    db.flush()


def _flush(db: Session, record: PreparedRecord) -> None:
    """Flush, turning a unique-index race into Route53's duplicate error."""
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise invalid_change_batch(
            f"[Tried to create resource record set [{record.describe()}] but it already exists]",
            status_code=409,
        ) from None


def touch_zone(zone: HostedZone) -> None:
    zone.updated_at = utcnow()


# ---------------------------------------------------------------- single-record operations


def create_record(db: Session, zone: HostedZone, data: RecordSetCreate) -> tuple[RecordSet, Change]:
    try:
        record = prepare_record(zone, data.name, data.type, data)
        check_conflicts(db, zone, record)
        row = apply_create(db, zone, record)
        change = record_change(db, zone.id, [record.to_action("CREATE")])
        touch_zone(zone)
        db.commit()
    except AppError:
        db.rollback()
        raise
    db.refresh(row)
    return row, change


def update_record(
    db: Session, zone: HostedZone, row: RecordSet, data: RecordSetUpdate
) -> tuple[RecordSet, Change]:
    if row.is_default and (data.routing_policy != "SIMPLE" or data.alias is not None):
        raise invalid_input(
            "The default NS and SOA records use simple routing and can't be alias records."
        )
    try:
        record = prepare_record(
            zone, row.name, row.type, data, allow_soa=row.type == "SOA" and row.is_default
        )
        check_conflicts(db, zone, record, exclude_id=row.id)
        apply_update(db, row, record)
        change = record_change(db, zone.id, [record.to_action("UPSERT")])
        touch_zone(zone)
        db.commit()
    except AppError:
        db.rollback()
        raise
    db.refresh(row)
    return row, change


def delete_record(db: Session, zone: HostedZone, row: RecordSet) -> Change:
    try:
        ensure_deletable(row)
        action = {
            "action": "DELETE",
            "name": row.name,
            "type": row.type,
            "set_identifier": row.set_identifier,
        }
        apply_delete(db, row)
        change = record_change(db, zone.id, [action])
        touch_zone(zone)
        db.commit()
    except AppError:
        db.rollback()
        raise
    return change
