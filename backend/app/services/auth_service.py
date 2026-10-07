from datetime import timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.security import hash_token, new_session_token, verify_password
from app.models import User, UserSession
from app.models._common import utcnow
from app.schemas.auth import LoginRequest


def _invalid_credentials() -> AppError:
    # Same wording whichever part was wrong, so usernames cannot be probed
    return AppError(
        "InvalidCredentials",
        "Your authentication information is incorrect. Please try again.",
        401,
    )


def login(db: Session, data: LoginRequest) -> tuple[User, str]:
    """Verify credentials and open a session. Returns the user and the raw cookie token."""
    user = db.scalar(select(User).where(User.username == data.username.strip()))
    if user is None or not verify_password(data.password, user.password_hash):
        raise _invalid_credentials()
    if data.login_type == "iam":
        account = (data.account_id or "").replace("-", "").strip()
        if account != user.account_id:
            raise _invalid_credentials()

    token = new_session_token()
    db.add(
        UserSession(
            token_hash=hash_token(token),
            user_id=user.id,
            expires_at=utcnow() + timedelta(days=get_settings().session_ttl_days),
        )
    )
    db.commit()
    return user, token


def user_for_token(db: Session, token: str) -> User | None:
    session = db.get(UserSession, hash_token(token))
    if session is None:
        return None
    if session.expires_at <= utcnow():
        db.delete(session)
        db.commit()
        return None
    return session.user


def logout(db: Session, token: str) -> None:
    db.execute(delete(UserSession).where(UserSession.token_hash == hash_token(token)))
    db.commit()
