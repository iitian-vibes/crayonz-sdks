"""Base HTTP client + resource composition.

Mirrors @crayonz-ai/sdk (TypeScript). Uses httpx for sync transport — async
support can be added later via an AsyncClient subclass without breaking the
public API.
"""
from __future__ import annotations

from typing import Any, Mapping, Optional

import httpx

from ._exceptions import CrayonzError

DEFAULT_BASE_URLS = {
    "memes": "https://memeagent-199406543652.asia-south1.run.app",
    "content": "https://content-api-199406543652.asia-south1.run.app",
    "design": "https://design-api-199406543652.asia-south1.run.app",
}

USER_AGENT = "crayonz-python-sdk/0.1.2"


class _BaseClient:
    """Base HTTP transport. Subclassed by resource classes."""

    def __init__(
        self,
        api_key: str,
        *,
        base_urls: Optional[Mapping[str, str]] = None,
        tag: Optional[str] = None,
        timeout: float = 60.0,
        http_client: Optional[httpx.Client] = None,
    ) -> None:
        if not api_key:
            raise ValueError("api_key is required")
        if not (api_key.startswith("cz_live_") or api_key.startswith("cz_test_")):
            raise ValueError("api_key must start with cz_live_ or cz_test_")
        self._api_key = api_key
        self._base_urls = dict(DEFAULT_BASE_URLS)
        if base_urls:
            self._base_urls.update(base_urls)
        self._tag = tag
        self._timeout = timeout
        self._http = http_client or httpx.Client(timeout=timeout)
        self._owns_http = http_client is None

    def close(self) -> None:
        if self._owns_http:
            self._http.close()

    def __enter__(self) -> "_BaseClient":
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()

    def _request(self, service: str, path: str, body: Any) -> Any:
        base = self._base_urls.get(service)
        if not base:
            raise CrayonzError(f"Unknown service: {service}", status=0, body=None, endpoint=path)
        url = f"{base}{path}"
        headers = {
            "Content-Type": "application/json",
            "X-API-Key": self._api_key,
            "User-Agent": USER_AGENT,
        }
        if self._tag:
            headers["X-Crayonz-Tag"] = self._tag

        try:
            resp = self._http.post(url, headers=headers, json=body)
        except httpx.TimeoutException as exc:
            raise CrayonzError(
                f"Request timed out after {self._timeout}s",
                status=0,
                body=None,
                endpoint=path,
            ) from exc
        except httpx.HTTPError as exc:
            raise CrayonzError(
                f"Network error: {exc}",
                status=0,
                body=None,
                endpoint=path,
            ) from exc

        try:
            parsed: Any = resp.json()
        except ValueError:
            parsed = None

        if resp.status_code >= 400:
            message = None
            if isinstance(parsed, dict):
                message = parsed.get("detail") or parsed.get("error")
            if not message:
                message = f"Request failed with status {resp.status_code}"
            raise CrayonzError(
                str(message),
                status=resp.status_code,
                body=parsed,
                endpoint=path,
            )

        return parsed


class _MemesResource:
    def __init__(self, parent: "Client") -> None:
        self._parent = parent

    def generate(
        self,
        *,
        topic: str,
        tone: Optional[str] = None,
        count: Optional[int] = None,
        meme_format: Optional[str] = None,
        audience: Optional[str] = None,
    ) -> dict:
        """Generate AI memes from a topic.

        Returns a dict with ``memes`` (list), ``cost_usd``, etc.
        """
        body: dict[str, Any] = {"topic": topic}
        if tone is not None:
            body["tone"] = tone
        if count is not None:
            body["count"] = count
        if meme_format is not None:
            body["meme_format"] = meme_format
        if audience is not None:
            body["audience"] = audience
        return self._parent._request("memes", "/generate", body)


class _ContentResource:
    def __init__(self, parent: "Client") -> None:
        self._parent = parent

    def generate_blog(self, **kwargs: Any) -> dict:
        """Long-form SEO blog generator. Pass topic, tone, target_length, etc."""
        return self._parent._request("content", "/api/blog/generate", kwargs)

    def generate_post(self, **kwargs: Any) -> dict:
        """Multi-slide Instagram carousel."""
        return self._parent._request("content", "/api/instagram/post", kwargs)

    def generate_reel(self, **kwargs: Any) -> dict:
        """Instagram reel script generator."""
        return self._parent._request("content", "/api/instagram/reel", kwargs)

    def generate_general(self, **kwargs: Any) -> dict:
        """Generic social copy generator."""
        return self._parent._request("content", "/api/instagram/general", kwargs)


class _DesignResource:
    def __init__(self, parent: "Client") -> None:
        self._parent = parent

    def discover_trends(self, **kwargs: Any) -> dict:
        """Trending design themes for collegiate merchandise."""
        return self._parent._request("design", "/api/trends/discover", kwargs)

    def generate(self, **kwargs: Any) -> dict:
        """Generate a print-ready design from a text prompt."""
        return self._parent._request("design", "/api/design/generate", kwargs)

    def generate_mockup(self, **kwargs: Any) -> dict:
        """Place a design onto an apparel mockup."""
        return self._parent._request("design", "/api/mockup/generate", kwargs)

    def customize(self, **kwargs: Any) -> dict:
        """Iterate on an existing design."""
        return self._parent._request("design", "/api/design/custom", kwargs)

    def score(self, **kwargs: Any) -> dict:
        """Quality and printability score for a design."""
        return self._parent._request("design", "/api/quality/score", kwargs)


class Client(_BaseClient):
    """Main entry point for the Crayonz API.

    Example:
        >>> from crayonz import Client
        >>> client = Client(api_key="cz_live_...")
        >>> memes = client.memes.generate(topic="coding", tone="sarcastic", count=3)
        >>> client.close()

    Or as a context manager:
        >>> with Client(api_key="cz_live_...") as client:
        ...     trends = client.design.discover_trends(category="apparel")
    """

    def __init__(self, api_key: str, **kwargs: Any) -> None:
        super().__init__(api_key, **kwargs)
        self.memes = _MemesResource(self)
        self.content = _ContentResource(self)
        self.design = _DesignResource(self)
