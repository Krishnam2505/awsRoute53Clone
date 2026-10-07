from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import PageParams, get_owned_zone, page_params
from app.db.session import get_db
from app.models import HostedZone
from app.schemas.common import ERROR_RESPONSES, ChangeInfo, Page
from app.schemas.record_set import (
    RecordSetCreate,
    RecordSetOut,
    RecordSetUpdate,
    RecordSetWriteResponse,
    RecordType,
    RoutingPolicy,
)
from app.services import record_service

router = APIRouter(
    prefix="/hostedzones/{zone_id}/records", tags=["records"], responses=ERROR_RESPONSES
)


@router.get("", response_model=Page[RecordSetOut])
def list_record_sets(
    search: str | None = Query(None, description="Matches record name or value"),
    type: RecordType | None = Query(None),
    routing_policy: RoutingPolicy | None = Query(None),
    paging: PageParams = Depends(page_params),
    zone: HostedZone = Depends(get_owned_zone),
    db: Session = Depends(get_db),
) -> Page[RecordSetOut]:
    rows, total = record_service.list_records(
        db,
        zone,
        search=search,
        record_type=type,
        routing_policy=routing_policy,
        page=paging.page,
        page_size=paging.page_size,
        sort=paging.sort,
        order=paging.order,
    )
    return Page(
        items=[record_service.to_schema(r) for r in rows],
        total=total,
        page=paging.page,
        page_size=paging.page_size,
    )


@router.post("", response_model=RecordSetWriteResponse, status_code=status.HTTP_201_CREATED)
def create_record_set(
    data: RecordSetCreate,
    zone: HostedZone = Depends(get_owned_zone),
    db: Session = Depends(get_db),
) -> RecordSetWriteResponse:
    row, change = record_service.create_record(db, zone, data)
    return RecordSetWriteResponse(
        record_set=record_service.to_schema(row), change=ChangeInfo.model_validate(change)
    )


@router.get("/{record_id}", response_model=RecordSetOut)
def get_record_set(
    record_id: str, zone: HostedZone = Depends(get_owned_zone), db: Session = Depends(get_db)
) -> RecordSetOut:
    return record_service.to_schema(record_service.get_record(db, zone, record_id))


@router.put("/{record_id}", response_model=RecordSetWriteResponse)
def replace_record_set(
    record_id: str,
    data: RecordSetUpdate,
    zone: HostedZone = Depends(get_owned_zone),
    db: Session = Depends(get_db),
) -> RecordSetWriteResponse:
    """Replace values, TTL and routing fields. Name and type are fixed."""
    row = record_service.get_record(db, zone, record_id)
    row, change = record_service.update_record(db, zone, row, data)
    return RecordSetWriteResponse(
        record_set=record_service.to_schema(row), change=ChangeInfo.model_validate(change)
    )


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_record_set(
    record_id: str, zone: HostedZone = Depends(get_owned_zone), db: Session = Depends(get_db)
) -> Response:
    """The default SOA and apex NS records are refused with 400."""
    row = record_service.get_record(db, zone, record_id)
    record_service.delete_record(db, zone, row)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
