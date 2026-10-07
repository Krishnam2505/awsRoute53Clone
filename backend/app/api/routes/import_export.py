from typing import Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.api.deps import get_owned_zone
from app.db.session import get_db
from app.models import HostedZone
from app.schemas.common import ERROR_RESPONSES
from app.schemas.import_export import ImportRequest, ImportResult
from app.services import import_export_service

router = APIRouter(
    prefix="/hostedzones/{zone_id}", tags=["import / export"], responses=ERROR_RESPONSES
)


@router.post("/import", response_model=ImportResult)
def import_zone_file(
    data: ImportRequest,
    dry_run: bool = Query(True, description="true returns a preview without writing anything"),
    zone: HostedZone = Depends(get_owned_zone),
    db: Session = Depends(get_db),
) -> ImportResult:
    """Parse a BIND zone file. The apex SOA and NS are skipped, as Route53 keeps its own."""
    return import_export_service.import_zone_file(db, zone, data.zone_file, dry_run=dry_run)


@router.get(
    "/export",
    responses={200: {"content": {"text/plain": {}, "application/json": {}}}},
    response_class=Response,
)
def export_zone(
    format: Literal["bind", "json"] = Query("bind"),
    zone: HostedZone = Depends(get_owned_zone),
    db: Session = Depends(get_db),
) -> Response:
    body, media_type, filename = import_export_service.export_zone(db, zone, format)
    return Response(
        content=body,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
