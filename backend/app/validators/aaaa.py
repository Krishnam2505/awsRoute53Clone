"""AAAA: IPv6 address, e.g. 2001:db8::8a2e:370:7334"""

import ipaddress

from app.validators.base import require_values, validate_each


def _check(value: str) -> str:
    try:
        ipaddress.IPv6Address(value)
    except ValueError:
        raise ValueError(f"The record value is not a valid IPv6 address: {value}") from None
    # Route53 stores the address the way it was entered
    return value.lower()


def validate(values: list[str]) -> list[str]:
    require_values(values, type_name="AAAA")
    return validate_each(values, _check)
