from __future__ import annotations

from typing import TYPE_CHECKING, List, Optional

if TYPE_CHECKING:
    from .._client import _Transport


class SizingResource:
    def __init__(self, transport: "_Transport") -> None:
        self._transport = transport

    def recommend(
        self,
        *,
        image: str,
        size_chart: str,
        image_type: Optional[str] = None,
        available_sizes: Optional[List[str]] = None,
    ) -> dict:
        """AI size recommendation from a product (or shopper) image + a size chart (plain text, max 10,000 chars)."""
        body = {
            "image": image,
            "sizeChart": size_chart,
            "imageType": image_type,
            "availableSizes": available_sizes,
        }
        body = {k: v for k, v in body.items() if v is not None}
        return self._transport.request("POST", "/v1/size-recommendation", body=body)
