from typing import Literal

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import PageParams, get_current_user, get_owned_zone, page_params
from app.db.session import get_db
from app.models import HostedZone, User
from app.schemas.common import ERROR_RESPONSES, ChangeInfo, Page
from app.schemas.hosted_zone import (
    HostedZoneCreate,
    HostedZoneDetail,
    HostedZoneSummary,
    HostedZoneUpdate,
    HostedZoneWriteResponse,
)
from app.services import zone_service

router = APIRouter(prefix="/hostedzones", tags=["hosted zones"], responses=ERROR_RESPONSES)


@router.get("", response_model=Page[HostedZoneSummary])
def list_hosted_zones(
    search: str | None = Query(None, description="Matches name, description or ID"),
    type: Literal["public", "private"] | None = Query(None),
    paging: PageParams = Depends(page_params),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Page[HostedZoneSummary]:
    items, total = zone_service.list_zones(
        db,
        user,
        search=search,
        zone_type=type,
        page=paging.page,
        page_size=paging.page_size,
        sort=paging.sort,
        order=paging.order,
    )
    return Page(items=items, total=total, page=paging.page, page_size=paging.page_size)


@router.post("", response_model=HostedZoneWriteResponse, status_code=status.HTTP_201_CREATED)
def create_hosted_zone(
    data: HostedZoneCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> HostedZoneWriteResponse:
    """Create a zone. Route53's default SOA and NS records are created with it."""
    zone, change = zone_service.create_zone(db, user, data)
    return HostedZoneWriteResponse(
        hosted_zone=zone_service.to_detail(db, zone), change=ChangeInfo.model_validate(change)
    )


@router.get("/{zone_id}", response_model=HostedZoneDetail)
def get_hosted_zone(
    zone: HostedZone = Depends(get_owned_zone), db: Session = Depends(get_db)
) -> HostedZoneDetail:
    return zone_service.to_detail(db, zone)


@router.patch("/{zone_id}", response_model=HostedZoneWriteResponse)
def update_hosted_zone(
    data: HostedZoneUpdate,
    zone: HostedZone = Depends(get_owned_zone),
    db: Session = Depends(get_db),
) -> HostedZoneWriteResponse:
    """Edit the description, tags and VPC associations: everything Route53 lets you change."""
    zone, change = zone_service.update_zone(db, zone, data)
    return HostedZoneWriteResponse(
        hosted_zone=zone_service.to_detail(db, zone), change=ChangeInfo.model_validate(change)
    )


@router.delete("/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_hosted_zone(
    zone: HostedZone = Depends(get_owned_zone), db: Session = Depends(get_db)
) -> Response:
    """Refused with HostedZoneNotEmpty (409) while non-default records exist."""
    zone_service.delete_zone(db, zone)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
