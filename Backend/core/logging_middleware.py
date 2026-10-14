"""
CarbonVault Phase 3: Structured JSON Logging & Request ID Middleware.
Enforces request tracing, latency tracking, slow-request alerts, and structured JSON logs.
"""

import time
import uuid
import logging
import sys
from contextvars import ContextVar
from typing import Optional
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from pythonjsonlogger import jsonlogger

# Context variable to store current request ID across async tasks
request_id_ctx: ContextVar[str] = ContextVar("request_id", default="")

class CustomJsonFormatter(jsonlogger.JsonFormatter):
    def add_fields(self, log_record, record, message_dict):
        super().add_fields(log_record, record, message_dict)
        log_record["timestamp"] = self.formatTime(record, self.datefmt)
        log_record["level"] = record.levelname
        log_record["logger"] = record.name
        req_id = request_id_ctx.get()
        if req_id:
            log_record["request_id"] = req_id


def setup_structured_logging(debug: bool = False, sentry_dsn: Optional[str] = None):
    """Configure root logger to output structured JSON."""
    log_level = logging.DEBUG if debug else logging.INFO
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Avoid duplicate handlers
    for h in list(root_logger.handlers):
        root_logger.removeHandler(h)

    handler = logging.StreamHandler(sys.stdout)
    formatter = CustomJsonFormatter(
        "%(timestamp)s %(level)s %(logger)s %(message)s"
    )
    handler.setFormatter(formatter)
    root_logger.addHandler(handler)

    # Optional Sentry initialization
    if sentry_dsn:
        try:
            import sentry_sdk
            sentry_sdk.init(
                dsn=sentry_dsn,
                traces_sample_rate=0.1,
            )
            root_logger.info("Sentry monitoring initialized successfully.")
        except Exception as e:
            root_logger.warning(f"Could not initialize Sentry: {e}")


class RequestIdMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, slow_threshold_ms: float = 500.0):
        super().__init__(app)
        self.slow_threshold_ms = slow_threshold_ms
        self.logger = logging.getLogger("carbonvault.http")

    async def dispatch(self, request: Request, call_next) -> Response:
        # Extract or generate Request ID
        req_id = request.headers.get("X-Request-ID") or f"req_{uuid.uuid4().hex[:12]}"
        token = request_id_ctx.set(req_id)

        start_time = time.perf_counter()
        try:
            response = await call_next(request)
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

            response.headers["X-Request-ID"] = req_id

            # Check for slow requests
            if duration_ms >= self.slow_threshold_ms and request.url.path not in ("/health", "/ready"):
                self.logger.warning(
                    f"Slow request detected: {request.method} {request.url.path} took {duration_ms}ms (threshold: {self.slow_threshold_ms}ms)",
                    extra={
                        "event": "slow_request",
                        "method": request.method,
                        "path": request.url.path,
                        "status_code": response.status_code,
                        "duration_ms": duration_ms,
                    }
                )
            else:
                self.logger.info(
                    f"{request.method} {request.url.path} {response.status_code} ({duration_ms}ms)",
                    extra={
                        "method": request.method,
                        "path": request.url.path,
                        "status_code": response.status_code,
                        "duration_ms": duration_ms,
                    }
                )

            return response
        except Exception as exc:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            self.logger.error(
                f"Unhandled error processing {request.method} {request.url.path}: {exc}",
                exc_info=True,
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "duration_ms": duration_ms,
                }
            )
            raise
        finally:
            request_id_ctx.reset(token)
