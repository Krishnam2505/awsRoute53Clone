"""Route53-style identifiers."""

import secrets
import string
import uuid

_UPPER_ALNUM = string.ascii_uppercase + string.digits
_LOWER_ALNUM = string.ascii_lowercase + string.digits


def _random(alphabet: str, length: int) -> str:
    return "".join(secrets.choice(alphabet) for _ in range(length))


def new_zone_id() -> str:
    """'Z' plus 20 uppercase letters and digits, e.g. Z0123456789ABCDEFGHIJ."""
    return "Z" + _random(_UPPER_ALNUM, 20)


def new_change_id() -> str:
    """'C' plus random uppercase alphanumerics, like Route53 change IDs."""
    return "C" + _random(_UPPER_ALNUM, 20)


def new_record_id() -> str:
    """Short random ID used in record URLs."""
    return _random(_LOWER_ALNUM, 12)


def new_caller_reference() -> str:
    return str(uuid.uuid4())
