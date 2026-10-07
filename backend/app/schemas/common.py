from datetime import datetime

from pydantic import BaseModel, ConfigDict


class FieldError(BaseModel):
    field: str
    message: str


class ErrorBody(BaseModel):
    code: str
    message: str
    field_errors: list[FieldError] = []


class ErrorResponse(BaseModel):
    error: ErrorBody


class Page[T](BaseModel):
    """The envelope every list endpoint returns."""

    items: list[T]
    total: int
    page: int
    page_size: int


class ChangeInfo(BaseModel):
    """Returned after every write, like Route53's ChangeInfo."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    status: str
    comment: str | None = None
    submitted_at: datetime


ERROR_RESPONSES: dict[int | str, dict[str, object]] = {
    400: {"model": ErrorResponse, "description": "Invalid input"},
    401: {"model": ErrorResponse, "description": "Not signed in"},
    404: {"model": ErrorResponse, "description": "Not found"},
    409: {"model": ErrorResponse, "description": "Conflict"},
}
