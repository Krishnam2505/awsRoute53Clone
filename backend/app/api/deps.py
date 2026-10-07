"""Shared route dependencies: the signed-in user and pagination parameters."""

from dataclasses import dataclass
from typing import Literal

from fastapi import Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import not_authenticated
from app.db.session import get_db
from app.models import HostedZone, User
from app.services import auth_service, zone_service


def session_token(request: Request) -> str | None:
    return request.cookies.get(get_settings().session_cookie_name)


def get_current_user(
    token: str | None = Depends(session_token), db: Session = Depends(get_db)
) -> User:
    if not token:
        raise not_authenticated()
    user = auth_service.user_for_token(db, token)
    if user is None:
        raise not_authenticated()
    return user


def get_owned_zone(
    zone_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> HostedZone:
    return zone_service.get_zone(db, user, zone_id)


@dataclass
class PageParams:
    page: int
    page_size: int
    sort: str | None
    order: Literal["asc", "desc"]


def page_params(
    page: int = Query(1, ge=1, description="1-based page number"),
    page_size: int = Query(10, ge=1, le=100),
    sort: str | None = Query(None, description="Column to sort by"),
    order: Literal["asc", "desc"] = Query("asc"),
) -> PageParams:
    return PageParams(page=page, page_size=page_size, sort=sort, order=order)


__all__ = ["PageParams", "get_current_user", "get_owned_zone", "page_params"]
