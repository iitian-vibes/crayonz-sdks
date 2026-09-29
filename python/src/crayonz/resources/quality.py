from __future__ import annotations

from typing import TYPE_CHECKING, List, Optional

if TYPE_CHECKING:
    from .._client import _Transport


class QualityResource:
    def __init__(self, transport: "_Transport") -> None:
        self._transport = transport

    def score(
        self,
        *,
        image_url: str,
        design_brief: str,
        check_text: Optional[str] = None,
        brand_colors: Optional[List[str]] = None,
    ) -> dict:
        """Score a design 0-100 for printability, edge cleanliness and colour vibrancy."""
        body = {
            "image_url": image_url,
            "design_brief": design_brief,
            "check_text": check_text,
            "brand_colors": brand_colors,
        }
        body = {k: v for k, v in body.items() if v is not None}
        return self._transport.request("POST", "/api/quality/score", body=body)
