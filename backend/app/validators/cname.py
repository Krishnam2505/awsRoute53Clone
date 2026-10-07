"""CNAME: exactly one domain name, e.g. hostname.example.com"""

from app.validators.base import check_hostname, require_values, validate_each


def validate(values: list[str]) -> list[str]:
    require_values(values, exactly_one=True, type_name="CNAME")
    return validate_each(values, check_hostname)
