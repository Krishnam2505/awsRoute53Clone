"""SRV: 'priority weight port target', e.g. 10 5 80 hostname.example.com"""

from app.validators.base import check_hostname, parse_int, require_values, validate_each


def _check(value: str) -> str:
    parts = value.split()
    if len(parts) != 4:
        raise ValueError(
            f"An SRV value must be priority, weight, port and target, for example "
            f"10 5 80 hostname.example.com: {value}"
        )
    priority = parse_int(parts[0], 0, 65535, "The SRV priority")
    weight = parse_int(parts[1], 0, 65535, "The SRV weight")
    port = parse_int(parts[2], 0, 65535, "The SRV port")
    target = check_hostname(parts[3], "The SRV target")
    return f"{priority} {weight} {port} {target}"


def validate(values: list[str]) -> list[str]:
    require_values(values, type_name="SRV")
    return validate_each(values, _check)
