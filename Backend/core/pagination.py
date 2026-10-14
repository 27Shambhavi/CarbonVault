"""
CarbonVault Phase 3: Standard pagination and query limiter utility.
Prevents unbounded queries, enforces input limits (max 100 per page),
and returns standard pagination envelopes.
"""

from typing import Generic, TypeVar, List, Optional, Any, Dict
from pydantic import BaseModel, Field
from sqlalchemy.orm import Query
from starlette.responses import Response

T = TypeVar("T")

MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 20

class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1, description="Page number (1-indexed)")
    size: int = Field(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE, description="Number of items per page")

    @classmethod
    def from_query(cls, page: Optional[int] = 1, size: Optional[int] = DEFAULT_PAGE_SIZE) -> "PaginationParams":
        safe_page = max(1, page or 1)
        safe_size = min(MAX_PAGE_SIZE, max(1, size or DEFAULT_PAGE_SIZE))
        return cls(page=safe_page, size=safe_size)


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    size: int
    pages: int

    @classmethod
    def create(cls, items: List[Any], total: int, page: int, size: int) -> "PaginatedResponse":
        pages = max(1, (total + size - 1) // size) if total > 0 else 1
        return cls(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=pages,
        )


def paginate_query(
    query: Query,
    page: int = 1,
    size: int = DEFAULT_PAGE_SIZE,
    response: Optional[Response] = None
) -> Dict[str, Any]:
    """
    Paginates a SQLAlchemy query with hard bounds.
    Sets X-Total-Count, X-Page, and X-Per-Page headers on response if provided.
    """
    safe_page = max(1, page or 1)
    safe_size = min(MAX_PAGE_SIZE, max(1, size or DEFAULT_PAGE_SIZE))

    total = query.count()
    offset = (safe_page - 1) * safe_size
    items = query.offset(offset).limit(safe_size).all()
    pages = max(1, (total + safe_size - 1) // safe_size) if total > 0 else 1

    if response is not None:
        response.headers["X-Total-Count"] = str(total)
        response.headers["X-Page"] = str(safe_page)
        response.headers["X-Per-Page"] = str(safe_size)

    return {
        "items": items,
        "total": total,
        "page": safe_page,
        "size": safe_size,
        "pages": pages,
    }
