from __future__ import annotations

from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from .._client import _Transport


class MockupsResource:
    def __init__(self, transport: "_Transport") -> None:
        self._transport = transport

    def render(
        self,
        *,
        design_url: str,
        garment: str,
        color: Optional[str] = None,
        view: Optional[str] = None,
        fill_mode: Optional[str] = None,
    ) -> dict:
        """Render a design onto a real garment template, in a real colour."""
        body = {"design_url": design_url, "garment": garment, "color": color, "view": view, "fill_mode": fill_mode}
        body = {k: v for k, v in body.items() if v is not None}
        return self._transport.request("POST", "/api/mockup/render", body=body)
