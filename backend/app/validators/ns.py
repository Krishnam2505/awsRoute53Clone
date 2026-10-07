"""NS: domain name of a name server, e.g. ns-1.example.com"""

from app.validators.base import check_hostname, require_values, validate_each


def validate(values: list[str]) -> list[str]:
    require_values(values, type_name="NS")
    return validate_each(values, check_hostname)
