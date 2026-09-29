from __future__ import annotations

from typing import TYPE_CHECKING, List, Optional

if TYPE_CHECKING:
    from .._client import _Transport


class OutfitsResource:
    def __init__(self, transport: "_Transport") -> None:
        self._transport = transport

    def complete(self, *, product_images: List[str], user_image: Optional[str] = None) -> dict:
        """Suggest complementary pieces for a base product to form a styled outfit."""
        body = {"productImages": product_images, "userImage": user_image}
        body = {k: v for k, v in body.items() if v is not None}
        return self._transport.request("POST", "/v1/complete-outfit", body=body)
