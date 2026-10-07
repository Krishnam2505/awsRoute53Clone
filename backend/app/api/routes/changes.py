from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_owned_zone
from app.core.errors import AppError
from app.db.session import get_db
from app.models import Change, HostedZone, User
from app.schemas.change import ChangeBatchRequest
from app.schemas.common import ERROR_RESPONSES, ChangeInfo
from app.services.change_batch import apply_change_batch

router = APIRouter(tags=["changes"], responses=ERROR_RESPONSES)


@router.post("/hostedzones/{zone_id}/changes", response_model=ChangeInfo)
def change_record_sets(
    batch: ChangeBatchRequest,
    zone: HostedZone = Depends(get_owned_zone),
    db: Session = Depends(get_db),
) -> ChangeInfo:
    """Atomic batch of CREATE / UPSERT / DELETE actions: all of it applies, or none of it."""
    return ChangeInfo.model_validate(apply_change_batch(db, zone, batch))


@router.get("/changes/{change_id}", response_model=ChangeInfo)
def get_change(
    change_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ChangeInfo:
    """Change status. Changes apply instantly here, so this is always INSYNC."""
    change = db.scalar(
        select(Change)
        .outerjoin(HostedZone, Change.zone_id == HostedZone.id)
        .where(Change.id == change_id)
        .where((HostedZone.owner_id == user.id) | (Change.zone_id.is_(None)))
    )
    if change is None:
        raise AppError(
            "NoSuchChange",
            f"A change with the specified change ID does not exist: {change_id}",
            404,
        )
    return ChangeInfo.model_validate(change)
