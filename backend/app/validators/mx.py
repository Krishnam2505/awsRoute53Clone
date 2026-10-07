"""MX: 'priority domain', e.g. 10 mail.example.com"""

from app.validators.base import check_hostname, parse_int, require_values, validate_each


def _check(value: str) -> str:
    parts = value.split()
    if len(parts) != 2:
        raise ValueError(
            f"An MX value must be a priority and a domain name, for example "
            f"10 mail.example.com: {value}"
        )
    priority = parse_int(parts[0], 0, 65535, "The MX priority")
    host = check_hostname(parts[1], "The mail server")
    return f"{priority} {host}"


def validate(values: list[str]) -> list[str]:
    require_values(values, type_name="MX")
    return validate_each(values, _check)
