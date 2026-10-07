"""One error type for the whole API, rendered as:

    { "error": { "code": "...", "message": "...", "field_errors": [...] } }

Codes are borrowed from the real Route53 API so the frontend can show the
console's wording.
"""

from dataclasses import dataclass, field


@dataclass
class FieldErrorItem:
    field: str
    message: str


@dataclass
class AppError(Exception):
    code: str
    message: str
    status_code: int = 400
    field_errors: list[FieldErrorItem] = field(default_factory=list)

    def __str__(self) -> str:
        return f"{self.code}: {self.message}"


def invalid_input(message: str, field_errors: list[FieldErrorItem] | None = None) -> AppError:
    return AppError("InvalidInput", message, 400, field_errors or [])


def invalid_change_batch(
    message: str, status_code: int = 400, field_errors: list[FieldErrorItem] | None = None
) -> AppError:
    return AppError("InvalidChangeBatch", message, status_code, field_errors or [])


def no_such_hosted_zone(zone_id: str) -> AppError:
    return AppError("NoSuchHostedZone", f"No hosted zone found with ID: {zone_id}", 404)


def no_such_record_set(record_id: str) -> AppError:
    return AppError(
        "NoSuchResourceRecordSet", f"No resource record set found with ID: {record_id}", 404
    )


def hosted_zone_not_empty() -> AppError:
    return AppError(
        "HostedZoneNotEmpty",
        "The specified hosted zone contains non-required resource record sets and so "
        "cannot be deleted.",
        409,
    )


def not_authenticated() -> AppError:
    return AppError("NotAuthenticated", "You must sign in to perform this action.", 401)
