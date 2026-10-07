"""A: IPv4 address, e.g. 192.0.2.1"""

import ipaddress

from app.validators.base import require_values, validate_each


def _check(value: str) -> str:
    try:
        return str(ipaddress.IPv4Address(value))
    except ValueError:
        raise ValueError(f"The record value is not a valid IPv4 address: {value}") from None


def validate(values: list[str]) -> list[str]:
    require_values(values, type_name="A")
    return validate_each(values, _check)
