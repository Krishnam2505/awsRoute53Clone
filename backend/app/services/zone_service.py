"""Business rules for hosted zones."""

import re

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import (
    AppError,
    FieldErrorItem,
    hosted_zone_not_empty,
    invalid_input,
    no_such_hosted_zone,
)
from app.models import Change, HostedZone, HostedZoneTag, HostedZoneVPC, RecordSet, User
from app.models._common import utcnow
from app.schemas.hosted_zone import (
    HostedZoneCreate,
    HostedZoneDetail,
    HostedZoneSummary,
    HostedZoneUpdate,
    Tag,
    VPCIn,
    VPCOut,
)
from app.schemas.record_set import RecordSetFields
from app.services import record_service as rs
from app.services.changes import record_change
from app.utils.ids import new_caller_reference, new_zone_id
from app.utils.names import InvalidNameError, normalize_zone_name
from app.utils.nameservers import DEFAULT_NS_TTL, DEFAULT_SOA_TTL, pick_name_servers, soa_value
from app.utils.regions import AWS_REGIONS

MAX_DESCRIPTION = 256
MAX_TAGS = 50
CREATED_BY = "Route 53"
_VPC_ID = re.compile(r"^vpc-[0-9a-f]{8,17}$")


# ---------------------------------------------------------------- reading


def _record_count_column():  # type: ignore[no-untyped-def]
    """Computed with a COUNT subquery rather than stored, so it can never go stale."""
    return (
        select(func.count(RecordSet.id))
        .where(RecordSet.zone_id == HostedZone.id)
        .correlate(HostedZone)
        .scalar_subquery()
    )


def _summary(zone: HostedZone, record_count: int) -> HostedZoneSummary:
    return HostedZoneSummary(
        id=zone.id,
        name=zone.name,
        type="private" if zone.is_private else "public",
        created_by=CREATED_BY,
        record_count=record_count,
        description=zone.description,
        created_at=zone.created_at,
    )


def name_servers(db: Session, zone: HostedZone) -> list[str]:
    apex_ns = db.scalar(
        select(RecordSet)
        .where(
            RecordSet.zone_id == zone.id,
            RecordSet.name == zone.name,
            RecordSet.type == "NS",
            RecordSet.is_default.is_(True),
        )
        .options(selectinload(RecordSet.values))
    )
    return [v.value for v in apex_ns.values] if apex_ns else []


def to_detail(db: Session, zone: HostedZone) -> HostedZoneDetail:
    summary = _summary(zone, rs.count_records(db, zone.id))
    return HostedZoneDetail(
        **summary.model_dump(),
        caller_reference=zone.caller_reference,
        name_servers=name_servers(db, zone),
        tags=[Tag(key=t.key, value=t.value) for t in zone.tags],
        vpcs=[VPCOut(region=v.region, vpc_id=v.vpc_id) for v in zone.vpcs],
        updated_at=zone.updated_at,
    )


_SORTS = {
    "name": HostedZone.name,
    "created_at": HostedZone.created_at,
    "description": HostedZone.description,
    "type": HostedZone.is_private,
    "id": HostedZone.id,
}


def _escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def list_zones(
    db: Session,
    user: User,
    *,
    search: str | None = None,
    zone_type: str | None = None,
    page: int = 1,
    page_size: int = 10,
    sort: str | None = None,
    order: str = "asc",
) -> tuple[list[HostedZoneSummary], int]:
    count_col = _record_count_column().label("record_count")
    query: Select[tuple[HostedZone, int]] = select(HostedZone, count_col).where(
        HostedZone.owner_id == user.id
    )
    if zone_type in ("public", "private"):
        query = query.where(HostedZone.is_private.is_(zone_type == "private"))
    if search and search.strip():
        pattern = f"%{_escape_like(search.strip().lower())}%"
        query = query.where(
            or_(
                HostedZone.name.like(pattern, escape="\\"),
                func.lower(HostedZone.description).like(pattern, escape="\\"),
                func.lower(HostedZone.id).like(pattern, escape="\\"),
            )
        )

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0

    column = count_col if sort == "record_count" else _SORTS.get(sort or "name", HostedZone.name)
    direction = column.desc() if order == "desc" else column.asc()
    rows = db.execute(
        query.order_by(direction, HostedZone.name, HostedZone.id)
        .limit(page_size)
        .offset((page - 1) * page_size)
    ).all()
    return [_summary(zone, count) for zone, count in rows], total


def get_zone(db: Session, user: User, zone_id: str) -> HostedZone:
    """Another user's zone is reported as missing (404), never forbidden, so IDs can't be probed."""
    zone = db.scalar(
        select(HostedZone).where(HostedZone.id == zone_id, HostedZone.owner_id == user.id)
    )
    if zone is None:
        raise no_such_hosted_zone(zone_id)
    return zone


# ---------------------------------------------------------------- validation


def _validate_description(description: str | None, errors: list[FieldErrorItem]) -> str | None:
    if description is None:
        return None
    text = description.strip()
    if len(text) > MAX_DESCRIPTION:
        errors.append(
            FieldErrorItem(
                "description",
                f"The description can have a maximum of {MAX_DESCRIPTION} characters.",
            )
        )
    return text or None


def _validate_vpcs(vpcs: list[VPCIn], errors: list[FieldErrorItem]) -> list[VPCIn]:
    if not vpcs:
        errors.append(
            FieldErrorItem(
                "vpcs", "A private hosted zone must be associated with at least one VPC."
            )
        )
    seen: set[tuple[str, str]] = set()
    for index, vpc in enumerate(vpcs):
        if vpc.region not in AWS_REGIONS:
            errors.append(FieldErrorItem(f"vpcs[{index}].region", "Choose a Region."))
        if not _VPC_ID.match(vpc.vpc_id.strip()):
            errors.append(
                FieldErrorItem(
                    f"vpcs[{index}].vpc_id", "Enter a VPC ID in the format vpc-0123456789abcdef0."
                )
            )
        key = (vpc.region, vpc.vpc_id.strip())
        if key in seen:
            errors.append(FieldErrorItem(f"vpcs[{index}].vpc_id", "This VPC is already listed."))
        seen.add(key)
    return [VPCIn(region=v.region, vpc_id=v.vpc_id.strip()) for v in vpcs]


def _validate_tags(tags: list[Tag], errors: list[FieldErrorItem]) -> list[Tag]:
    if len(tags) > MAX_TAGS:
        errors.append(FieldErrorItem("tags", f"You can add up to {MAX_TAGS} tags."))
    seen: set[str] = set()
    for index, tag in enumerate(tags):
        key = tag.key.strip()
        if key.lower().startswith("aws:"):
            errors.append(FieldErrorItem(f"tags[{index}].key", "Tag keys can't start with aws:."))
        if key in seen:
            errors.append(FieldErrorItem(f"tags[{index}].key", "You must specify a unique key."))
        seen.add(key)
    return [Tag(key=t.key.strip(), value=t.value.strip()) for t in tags]


# ---------------------------------------------------------------- writing


def _default_record(
    zone: HostedZone, record_type: str, ttl: int, values: list[str]
) -> rs.PreparedRecord:
    return rs.prepare_record(
        zone,
        zone.name,
        record_type,
        RecordSetFields(ttl=ttl, values=values),
        allow_soa=True,
    )


def create_zone(db: Session, user: User, data: HostedZoneCreate) -> tuple[HostedZone, Change]:
    errors: list[FieldErrorItem] = []
    try:
        name = normalize_zone_name(data.name)
    except InvalidNameError as exc:
        name = data.name
        errors.append(FieldErrorItem("name", str(exc)))
    description = _validate_description(data.description, errors)
    is_private = data.type == "private"
    vpcs = _validate_vpcs(data.vpcs, errors) if is_private else []
    tags = _validate_tags(data.tags, errors)
    if errors:
        raise invalid_input(errors[0].message, errors)

    zone = HostedZone(
        id=new_zone_id(),
        owner_id=user.id,
        name=name,
        description=description,
        is_private=is_private,
        caller_reference=new_caller_reference(),
    )
    zone.vpcs = [HostedZoneVPC(region=v.region, vpc_id=v.vpc_id) for v in vpcs]
    zone.tags = [HostedZoneTag(key=t.key, value=t.value) for t in tags]
    db.add(zone)
    db.flush()

    # Route53 always creates the apex NS (four name servers) and SOA records itself
    servers = pick_name_servers()
    ns = _default_record(zone, "NS", DEFAULT_NS_TTL, servers)
    soa = _default_record(zone, "SOA", DEFAULT_SOA_TTL, [soa_value(servers[0], name)])
    rs.apply_create(db, zone, ns, is_default=True)
    rs.apply_create(db, zone, soa, is_default=True)

    change = record_change(
        db,
        zone.id,
        [
            {"action": "CREATE_HOSTED_ZONE", "name": name, "private": is_private},
            ns.to_action("CREATE"),
            soa.to_action("CREATE"),
        ],
    )
    db.commit()
    db.refresh(zone)
    return zone, change


def update_zone(db: Session, zone: HostedZone, data: HostedZoneUpdate) -> tuple[HostedZone, Change]:
    """Only the description, tags and VPC associations can change; name and type are fixed."""
    errors: list[FieldErrorItem] = []
    fields = data.model_fields_set
    actions: list[dict[str, object]] = []

    description = (
        _validate_description(data.description, errors) if "description" in fields else None
    )
    tags = _validate_tags(data.tags, errors) if data.tags is not None else None
    vpcs = None
    if data.vpcs is not None:
        if zone.is_private:
            vpcs = _validate_vpcs(data.vpcs, errors)
        elif data.vpcs:
            errors.append(
                FieldErrorItem("vpcs", "You can't associate VPCs with a public hosted zone.")
            )
    if errors:
        raise invalid_input(errors[0].message, errors)

    if "description" in fields:
        zone.description = description
        actions.append({"action": "UPDATE_COMMENT", "description": description})
    if tags is not None:
        zone.tags.clear()
        db.flush()
        zone.tags = [HostedZoneTag(key=t.key, value=t.value) for t in tags]
        actions.append({"action": "CHANGE_TAGS", "tags": [t.model_dump() for t in tags]})
    if vpcs is not None:
        zone.vpcs.clear()
        db.flush()
        zone.vpcs = [HostedZoneVPC(region=v.region, vpc_id=v.vpc_id) for v in vpcs]
        actions.append({"action": "CHANGE_VPCS", "vpcs": [v.model_dump() for v in vpcs]})

    zone.updated_at = utcnow()
    change = record_change(db, zone.id, actions or [{"action": "NO_CHANGE"}])
    db.commit()
    db.refresh(zone)
    return zone, change


def delete_zone(db: Session, zone: HostedZone) -> Change:
    if rs.count_records(db, zone.id, non_default_only=True) > 0:
        raise hosted_zone_not_empty()
    try:
        change = record_change(db, zone.id, [{"action": "DELETE_HOSTED_ZONE", "name": zone.name}])
        db.flush()
        db.delete(zone)  # cascades to record sets, values, tags and VPCs; the change keeps NULL
        db.commit()
    except AppError:
        db.rollback()
        raise
    return change
