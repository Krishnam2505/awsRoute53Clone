"""Writes the Change row that every mutation returns, like Route53's ChangeInfo."""

import json
from typing import Any

from sqlalchemy.orm import Session

from app.models import Change
from app.utils.ids import new_change_id


def record_change(
    db: Session, zone_id: str | None, actions: list[dict[str, Any]], comment: str | None = None
) -> Change:
    change = Change(
        id=new_change_id(),
        zone_id=zone_id,
        status="INSYNC",
        comment=comment,
        actions_json=json.dumps(actions),
    )
    db.add(change)
    return change


def get_change(db: Session, change_id: str) -> Change | None:
    return db.get(Change, change_id)
