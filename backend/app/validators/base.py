"""Shared plumbing for the per-type record value validators.

Each validator takes the raw values (one per line in the console form) and
returns them normalised, or raises ValueErrors listing every bad line so the
form can mark each one.
"""

from collections.abc import Callable
from dataclasses import dataclass

from app.utils.names import is_valid_hostname


@dataclass
class ValueIssue:
    index: int  # position in the values list, or -1 for the set as a whole
    message: str


class RecordValuesError(Exception):
    def __init__(self, errors: list[ValueIssue]) -> None:
        super().__init__("; ".join(e.message for e in errors))
        self.errors = errors


SingleValueCheck = Callable[[str], str]


def validate_each(values: list[str], check: SingleValueCheck) -> list[str]:
    """Run check() on every value, collecting all failures before raising."""
    cleaned: list[str] = []
    errors: list[ValueIssue] = []
    for index, raw in enumerate(values):
        try:
            cleaned.append(check(raw.strip()))
        except ValueError as exc:
            errors.append(ValueIssue(index, str(exc)))
    if errors:
        raise RecordValuesError(errors)
    return cleaned


def require_values(values: list[str], *, exactly_one: bool = False, type_name: str) -> None:
    if not values:
        raise RecordValuesError([ValueIssue(-1, "Enter a value for the record.")])
    if exactly_one and len(values) > 1:
        raise RecordValuesError([ValueIssue(-1, f"A {type_name} record can have only one value.")])


def parse_int(token: str, low: int, high: int, what: str) -> int:
    if not token.isdigit():
        raise ValueError(f"{what} must be an integer between {low} and {high}.")
    number = int(token)
    if not low <= number <= high:
        raise ValueError(f"{what} must be an integer between {low} and {high}.")
    return number


def check_hostname(token: str, what: str = "The value") -> str:
    if not is_valid_hostname(token):
        raise ValueError(f"{what} is not a valid domain name: {token}")
    return token
