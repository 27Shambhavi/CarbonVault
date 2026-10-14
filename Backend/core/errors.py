"""
CarbonVault Phase 3: Consistent API Error Handling.
Provides unified JSON error response envelopes with error code, human message,
and request ID for traceability.
"""

from typing import Any, Optional, Dict
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from .logging_middleware import request_id_ctx


def create_error_response(
    status_code: int,
    message: str,
    code: Optional[str] = None,
    details: Optional[Any] = None,
    request_id: Optional[str] = None,
) -> JSONResponse:
    req_id = request_id or request_id_ctx.get() or "unknown"
    error_code = code or f"ERR_{status_code}"

    payload = {
        "error": {
            "code": error_code,
            "message": message,
            "request_id": req_id,
            "details": details,
        },
        # detail kept for backward-compatibility with FastAPI standard format
        "detail": message,
    }
    return JSONResponse(status_code=status_code, content=payload)


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    message = str(exc.detail) if exc.detail else "An HTTP error occurred"
    code = f"HTTP_{exc.status_code}"
    return create_error_response(
        status_code=exc.status_code,
        message=message,
        code=code,
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = exc.errors()
    message = "Request validation failed"
    return create_error_response(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        message=message,
        code="VALIDATION_ERROR",
        details=errors,
    )


async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return create_error_response(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        message="Internal server error. Please try again later.",
        code="INTERNAL_SERVER_ERROR",
    )
