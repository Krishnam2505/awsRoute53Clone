from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, session_token
from app.core.config import get_settings
from app.db.session import get_db
from app.models import User
from app.schemas.auth import LoginRequest, UserOut
from app.schemas.common import ERROR_RESPONSES
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"], responses=ERROR_RESPONSES)


@router.post("/login", response_model=UserOut)
def login(data: LoginRequest, response: Response, db: Session = Depends(get_db)) -> User:
    """Check the demo credentials and set the HTTP-only session cookie."""
    settings = get_settings()
    user, token = auth_service.login(db, data)
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=settings.session_ttl_days * 24 * 3600,
        path="/",
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
    )
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    token: str | None = Depends(session_token),
    db: Session = Depends(get_db),
) -> Response:
    """Delete the session row and clear the cookie."""
    if token:
        auth_service.logout(db, token)
    settings = get_settings()
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(
        settings.session_cookie_name,
        path="/",
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
    )
    return response


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    """Who is signed in. The console calls this once on every page load."""
    return user
