"""FastAPI app factory: routers, CORS and the single error format."""

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.routes import auth, changes, hosted_zones, import_export, record_sets
from app.core.config import get_settings
from app.core.errors import AppError
from app.schemas.common import ErrorBody, ErrorResponse, FieldError

_HTTP_CODES = {
    400: "InvalidInput",
    401: "NotAuthenticated",
    403: "AccessDenied",
    404: "NotFound",
    405: "MethodNotAllowed",
    409: "Conflict",
}


def _error(status_code: int, body: ErrorBody) -> JSONResponse:
    return JSONResponse(status_code=status_code, content=ErrorResponse(error=body).model_dump())


def _field_path(location: tuple[int | str, ...]) -> str:
    """('body', 'values', 1) -> 'values[1]'"""
    parts = [p for p in location if p not in ("body", "query", "path")]
    path = ""
    for part in parts:
        if isinstance(part, int):
            path += f"[{part}]"
        else:
            path += ("." if path else "") + str(part)
    return path or "request"


def _friendly(message: str) -> str:
    if message.startswith("Value error, "):
        message = message.removeprefix("Value error, ")
    return message[:1].upper() + message[1:]


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error(_: Request, exc: AppError) -> JSONResponse:
        return _error(
            exc.status_code,
            ErrorBody(
                code=exc.code,
                message=exc.message,
                field_errors=[
                    FieldError(field=f.field, message=f.message) for f in exc.field_errors
                ],
            ),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        # FastAPI's default 422 becomes Route53's 400 InvalidInput in the shared format
        field_errors = [
            FieldError(field=_field_path(tuple(err["loc"])), message=_friendly(err["msg"]))
            for err in exc.errors()
        ]
        first = field_errors[0] if field_errors else None
        message = f"{first.field}: {first.message}" if first else "The request is not valid."
        return _error(
            400, ErrorBody(code="InvalidInput", message=message, field_errors=field_errors)
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = _HTTP_CODES.get(exc.status_code, "Error")
        return _error(exc.status_code, ErrorBody(code=code, message=str(exc.detail)))


def _document_errors_as_400(app: FastAPI) -> None:
    """Validation errors are returned as 400 InvalidInput, so drop FastAPI's 422 from the docs."""

    def openapi() -> dict[str, Any]:
        if app.openapi_schema:
            return app.openapi_schema
        schema = get_openapi(
            title=app.title,
            version=app.version,
            description=app.description,
            routes=app.routes,
        )
        for operations in schema.get("paths", {}).values():
            for operation in operations.values():
                operation.get("responses", {}).pop("422", None)
        for name in ("HTTPValidationError", "ValidationError"):
            schema.get("components", {}).get("schemas", {}).pop(name, None)
        app.openapi_schema = schema
        return schema

    app.openapi = openapi  # type: ignore[method-assign]


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version="1.0.0",
        description="Backend for the AWS Route 53 console clone. All routes live under /api/v1.",
        docs_url="/docs",
        openapi_url="/openapi.json",
    )
    # The Next.js /api rewrite keeps browser calls same-origin, so CORS only matters when
    # someone calls the API directly from another origin during development.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_error_handlers(app)

    for router in (
        auth.router,
        hosted_zones.router,
        record_sets.router,
        changes.router,
        import_export.router,
    ):
        app.include_router(router, prefix="/api/v1")

    _document_errors_as_400(app)

    @app.get("/api/health", tags=["health"])
    def health() -> dict[str, str]:
        """Liveness check for the hosting platform."""
        return {"status": "ok"}

    return app


app = create_app()
