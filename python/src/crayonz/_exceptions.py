"""Typed error hierarchy for the Crayonz SDK.

``CrayonzError`` is the catch-all base (also raised for network failures and
timeouts, which never got an HTTP status). ``APIError`` and its subclasses
are raised for a non-2xx response the API actually returned; each carries
``status``, ``body`` (the parsed JSON, or raw text if it wasn't JSON) and
``endpoint``.
"""
from __future__ import annotations

from typing import Any, Optional


class CrayonzError(Exception):
    """Raised on any non-2xx response or transport failure."""

    def __init__(self, message: str, *, status: int, body: Any, endpoint: str) -> None:
        super().__init__(message)
        self.status = status
        self.body = body
        self.endpoint = endpoint

    def __str__(self) -> str:
        return f"{super().__str__()} (status={self.status}, endpoint={self.endpoint})"


class APIError(CrayonzError):
    """Base class for every error the API itself returned."""


class AuthenticationError(APIError):
    """401 — missing, malformed, revoked or expired API key."""


class InsufficientCreditsError(APIError):
    """402 — balance below the call's cost, or a per-key monthly spend cap
    hit (``key_cap_exceeded``). Nothing was charged either way."""


class ValidationError(APIError):
    """422 (or 400) — request validation failed. ``errors`` carries the raw
    FastAPI-style ``detail`` list when the server sent one."""

    def __init__(
        self,
        message: str,
        *,
        status: int,
        body: Any,
        endpoint: str,
        errors: Optional[Any] = None,
    ) -> None:
        super().__init__(message, status=status, body=body, endpoint=endpoint)
        self.errors = errors


class RateLimitError(APIError):
    """429 — rate limited. ``retry_after`` (seconds) is set when the server
    sent a Retry-After header; the client already retried up to
    ``max_retries`` times before giving up and raising this."""

    def __init__(
        self,
        message: str,
        *,
        status: int,
        body: Any,
        endpoint: str,
        retry_after: Optional[float] = None,
    ) -> None:
        super().__init__(message, status=status, body=body, endpoint=endpoint)
        self.retry_after = retry_after


def extract_error_message(body: Any, status: int) -> str:
    """Extracts a human-readable message from any of the API's error body
    shapes: ``{status,detail:str}``, ``{detail:[{loc,msg,type}]}`` (FastAPI
    validation), ``{error,message}`` (customapi/VTO), ``{status,error}``
    (5xx)."""
    if isinstance(body, dict):
        detail = body.get("detail")
        if isinstance(detail, str):
            return detail
        if isinstance(detail, list) and detail:
            parts = []
            for entry in detail:
                if isinstance(entry, dict):
                    loc = entry.get("loc")
                    loc_str = ".".join(str(p) for p in loc) if isinstance(loc, list) else None
                    msg = entry.get("msg") or "invalid"
                    parts.append(f"{loc_str}: {msg}" if loc_str else str(msg))
                else:
                    parts.append(str(entry))
            if parts:
                return "; ".join(parts)
        message = body.get("message")
        if isinstance(message, str):
            return message
        error = body.get("error")
        if isinstance(error, str):
            return error
    return f"Request failed with status {status}"


def build_api_error(
    status: int,
    body: Any,
    endpoint: str,
    retry_after: Optional[float] = None,
) -> CrayonzError:
    """Builds the right typed error for an HTTP status + parsed body."""
    message = extract_error_message(body, status)

    if status == 401:
        return AuthenticationError(message, status=status, body=body, endpoint=endpoint)
    if status == 402:
        return InsufficientCreditsError(message, status=status, body=body, endpoint=endpoint)
    if status in (400, 422):
        errors = body.get("detail") if isinstance(body, dict) and isinstance(body.get("detail"), list) else None
        return ValidationError(message, status=status, body=body, endpoint=endpoint, errors=errors)
    if status == 429:
        return RateLimitError(message, status=status, body=body, endpoint=endpoint, retry_after=retry_after)
    return APIError(message, status=status, body=body, endpoint=endpoint)
