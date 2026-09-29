"""Base HTTP transport + client composition.

Mirrors @crayonz-ai/sdk (TypeScript). Uses httpx for sync transport — async
support can be added later via an AsyncClient subclass without breaking the
public API.
"""
from __future__ import annotations

import os
import random
import time
from email.utils import parsedate_to_datetime
from typing import Any, Mapping, Optional

import httpx

from ._exceptions import CrayonzError, build_api_error
from ._webhooks import verify_webhook_signature

DEFAULT_BASE_URL = "https://api.crayonz.ai"
DEFAULT_TIMEOUT = 60.0
DEFAULT_MAX_RETRIES = 2
VERSION = "0.2.0"
USER_AGENT = f"crayonz-python/{VERSION}"


def _backoff_seconds(attempt: int) -> float:
    """Exponential backoff with jitter: 0.5s, 1s, 2s, ... + 0-0.25s."""
    base = 0.5 * (2 ** attempt)
    jitter = random.random() * 0.25
    return base + jitter


def _parse_retry_after(header: Optional[str]) -> Optional[float]:
    if not header:
        return None
    try:
        return max(0.0, float(header))
    except ValueError:
        pass
    try:
        dt = parsedate_to_datetime(header)
        return max(0.0, dt.timestamp() - time.time())
    except (TypeError, ValueError):
        return None


class _Transport:
    """Low-level request method shared by every resource. Retries on 429
    and 5xx (respecting Retry-After) up to ``max_retries`` times, with
    exponential backoff + jitter. Never retries other 4xx."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        *,
        base_url: Optional[str] = None,
        timeout: float = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_MAX_RETRIES,
        tag: Optional[str] = None,
        http_client: Optional[httpx.Client] = None,
    ) -> None:
        api_key = api_key or os.environ.get("CRAYONZ_API_KEY")
        if not api_key:
            raise ValueError("api_key is required (pass it, or set the CRAYONZ_API_KEY env var)")
        if not (api_key.startswith("cz_live_") or api_key.startswith("cz_test_")):
            raise ValueError("Invalid api_key: must start with cz_live_ or cz_test_")

        self._api_key = api_key
        self._base_url = (base_url or DEFAULT_BASE_URL).rstrip("/")
        self._timeout = timeout
        self._max_retries = max_retries
        self._tag = tag
        self._http = http_client or httpx.Client(timeout=timeout)
        self._owns_http = http_client is None

    def close(self) -> None:
        if self._owns_http:
            self._http.close()

    def __enter__(self) -> "_Transport":
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()

    def _headers(self, method: str) -> dict:
        headers = {"X-API-Key": self._api_key, "User-Agent": USER_AGENT}
        if self._tag:
            headers["X-Crayonz-Tag"] = self._tag
        if method == "POST":
            headers["Content-Type"] = "application/json"
        return headers

    def request(
        self,
        method: str,
        path: str,
        *,
        body: Optional[Mapping[str, Any]] = None,
        query: Optional[Mapping[str, Any]] = None,
    ) -> Any:
        url = f"{self._base_url}{path}"
        headers = self._headers(method)
        clean_query = {k: v for k, v in (query or {}).items() if v is not None}

        attempt = 0
        while True:
            try:
                resp = self._http.request(
                    method,
                    url,
                    headers=headers,
                    params=clean_query or None,
                    json=body if method == "POST" else None,
                )
            except httpx.TimeoutException as exc:
                if attempt < self._max_retries:
                    time.sleep(_backoff_seconds(attempt))
                    attempt += 1
                    continue
                raise CrayonzError(
                    f"Request timed out after {self._timeout}s", status=0, body=None, endpoint=path
                ) from exc
            except httpx.HTTPError as exc:
                if attempt < self._max_retries:
                    time.sleep(_backoff_seconds(attempt))
                    attempt += 1
                    continue
                raise CrayonzError(f"Network error: {exc}", status=0, body=None, endpoint=path) from exc

            try:
                parsed: Any = resp.json() if resp.text else None
            except ValueError:
                parsed = resp.text

            if resp.status_code < 400:
                return parsed

            retry_after = _parse_retry_after(resp.headers.get("retry-after"))
            is_retryable = resp.status_code == 429 or resp.status_code >= 500

            if is_retryable and attempt < self._max_retries:
                time.sleep(retry_after if retry_after is not None else _backoff_seconds(attempt))
                attempt += 1
                continue

            raise build_api_error(resp.status_code, parsed, path, retry_after)


class Client:
    """Main entry point for the Crayonz API.

    Example::

        from crayonz import Client

        client = Client(api_key="cz_live_...")
        design = client.designs.create_and_wait(idea="Retro skate shop logo")
        print(design["file_url"])
        client.close()

    Or as a context manager::

        with Client(api_key="cz_live_...") as client:
            mockup = client.mockups.render(design_url=design["file_url"], garment="tshirt")
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        *,
        base_url: Optional[str] = None,
        timeout: float = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_MAX_RETRIES,
        tag: Optional[str] = None,
        http_client: Optional[httpx.Client] = None,
    ) -> None:
        self._transport = _Transport(
            api_key,
            base_url=base_url,
            timeout=timeout,
            max_retries=max_retries,
            tag=tag,
            http_client=http_client,
        )

        # Imported lazily (module scope would be circular: resources type-hint Client).
        from .resources.designs import DesignsResource
        from .resources.jobs import JobsResource
        from .resources.mockups import MockupsResource
        from .resources.outfits import OutfitsResource
        from .resources.photoshoots import PhotoshootsResource
        from .resources.quality import QualityResource
        from .resources.sizing import SizingResource
        from .resources.tasks import TasksResource
        from .resources.try_on import TryOnResource

        self.jobs = JobsResource(self._transport)
        self.designs = DesignsResource(self._transport, self.jobs)
        self.mockups = MockupsResource(self._transport)
        self.quality = QualityResource(self._transport)
        self.photoshoots = PhotoshootsResource(self._transport)
        self.tasks = TasksResource(self._transport)
        self.try_on = TryOnResource(self._transport)
        self.sizing = SizingResource(self._transport)
        self.outfits = OutfitsResource(self._transport)
        self.webhooks = _WebhooksResource()

    def close(self) -> None:
        self._transport.close()

    def __enter__(self) -> "Client":
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()


class _WebhooksResource:
    """Instance-bound wrapper so ``client.webhooks.verify(...)`` reads
    naturally alongside the other resources, even though verification is
    local-only and makes no network call."""

    def verify(self, raw_body, signature, secret) -> bool:  # type: ignore[no-untyped-def]
        return verify_webhook_signature(raw_body, signature, secret)
