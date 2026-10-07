"""One validator per record type. validate_values() dispatches on the type."""

from collections.abc import Callable

from app.validators import a, aaaa, caa, cname, mx, ns, ptr, soa, srv, txt
from app.validators.base import RecordValuesError, ValueIssue

VALIDATORS: dict[str, Callable[[list[str]], list[str]]] = {
    "A": a.validate,
    "AAAA": aaaa.validate,
    "CNAME": cname.validate,
    "TXT": txt.validate,
    "MX": mx.validate,
    "NS": ns.validate,
    "PTR": ptr.validate,
    "SRV": srv.validate,
    "CAA": caa.validate,
    "SOA": soa.validate,
}


def validate_values(record_type: str, values: list[str]) -> list[str]:
    cleaned = [v for v in (value.strip() for value in values) if v]
    return VALIDATORS[record_type](cleaned)


__all__ = ["VALIDATORS", "RecordValuesError", "ValueIssue", "validate_values"]
