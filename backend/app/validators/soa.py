"""SOA: 'primary-ns admin-email serial refresh retry expire minimum'"""

from app.validators.base import check_hostname, parse_int, require_values, validate_each

_MAX = 4294967295


def _check(value: str) -> str:
    parts = value.split()
    if len(parts) != 7:
        raise ValueError(
            "An SOA value must have seven fields: primary name server, administrator email, "
            "serial number, refresh time, retry time, expire time and minimum TTL."
        )
    primary = check_hostname(parts[0], "The primary name server")
    email = check_hostname(parts[1], "The administrator email")
    names = ("serial number", "refresh time", "retry time", "expire time", "minimum TTL")
    numbers = [
        str(parse_int(token, 0, _MAX, f"The SOA {what}"))
        for token, what in zip(parts[2:], names, strict=True)
    ]
    return " ".join([primary, email, *numbers])


def validate(values: list[str]) -> list[str]:
    require_values(values, exactly_one=True, type_name="SOA")
    return validate_each(values, _check)
