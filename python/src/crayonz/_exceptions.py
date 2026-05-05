"""Single error type for all SDK failures so consumers can `except CrayonzError`."""
from __future__ import annotations

from typing import Any


class CrayonzError(Exception):
    """Raised on any non-2xx response or transport failure."""

    def __init__(self, message: str, *, status: int, body: Any, endpoint: str) -> None:
        super().__init__(message)
        self.status = status
        self.body = body
        self.endpoint = endpoint

    def __str__(self) -> str:
        return f"{super().__str__()} (status={self.status}, endpoint={self.endpoint})"
