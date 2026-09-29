from __future__ import annotations

from typing import TYPE_CHECKING, Any, List, Optional

if TYPE_CHECKING:
    from .._client import _Transport
    from .jobs import JobsResource


class DesignsResource:
    def __init__(self, transport: "_Transport", jobs: "JobsResource") -> None:
        self._transport = transport
        self._jobs = jobs

    def create(
        self,
        *,
        idea: str,
        style_preferences: Optional[List[str]] = None,
        color_preferences: Optional[List[str]] = None,
        target_products: Optional[List[str]] = None,
        suggested_text: Optional[str] = None,
        auto_mockups: Optional[bool] = None,
        garment_colors: Optional[List[str]] = None,
        use_references: Optional[bool] = None,
        reference_image_base64: Optional[str] = None,
        sync: bool = False,
    ) -> dict:
        """Create a print-ready design from an idea. Async by default —
        returns a queued job ({"status": "queued", "job_id": ..., ...});
        poll it with ``client.jobs.get``/``client.jobs.wait``, or pass
        ``sync=True`` to wait in-request (sends ``?async=0`` — only
        sensible for short calls, the server cuts a synchronous request off
        past 100s). See :meth:`create_and_wait` for the common case."""
        body = {
            "idea": idea,
            "style_preferences": style_preferences,
            "color_preferences": color_preferences,
            "target_products": target_products,
            "suggested_text": suggested_text,
            "auto_mockups": auto_mockups,
            "garment_colors": garment_colors,
            "use_references": use_references,
            "reference_image_base64": reference_image_base64,
        }
        body = {k: v for k, v in body.items() if v is not None}
        query = {"async": 0} if sync else None
        return self._transport.request("POST", "/api/design/custom", body=body, query=query)

    def create_and_wait(
        self,
        *,
        idea: str,
        timeout: float = 300.0,
        interval: float = 3.0,
        **kwargs: Any,
    ) -> dict:
        """Create a design and poll until it's done. Convenience wrapper
        over :meth:`create` + ``client.jobs.wait``.

        Example::

            design = client.designs.create_and_wait(idea="Retro skate shop logo")
            print(design["file_url"])
        """
        queued = self.create(idea=idea, **kwargs)
        job = self._jobs.wait(queued["job_id"], timeout=timeout, interval=interval)
        return job["result"]

    def list(self, *, tag: Optional[str] = None, limit: Optional[int] = None) -> dict:
        """List designs your key has generated, newest first. Free."""
        return self._transport.request("GET", "/api/designs", query={"tag": tag, "limit": limit})

    def get(self, design_id: str) -> dict:
        """Fetch a single design by id. Free."""
        if not design_id:
            raise ValueError("design_id is required")
        return self._transport.request("GET", f"/api/designs/{design_id}")
