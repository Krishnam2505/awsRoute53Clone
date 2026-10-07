"""Password hashing and session-token helpers.

Only the SHA-256 hash of a session token is stored, so a leaked database
cannot be replayed as a cookie.
"""

import hashlib
import secrets

import bcrypt

# bcrypt only reads the first 72 bytes of a password; newer versions raise instead of
# truncating, so truncate explicitly
_MAX_BCRYPT_BYTES = 72


def _encode(password: str) -> bytes:
    return password.encode()[:_MAX_BCRYPT_BYTES]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_encode(password), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(_encode(password), password_hash.encode())
    except ValueError:
        return False  # malformed hash


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
