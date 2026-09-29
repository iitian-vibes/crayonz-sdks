from __future__ import annotations

from typing import TYPE_CHECKING, Any, Dict, List, Optional

if TYPE_CHECKING:
    from .._client import _Transport


class TryOnResource:
    def __init__(self, transport: "_Transport") -> None:
        self._transport = transport

    def create(self, *, user_photo: str, product_image: str, custom_prompt: Optional[str] = None) -> dict:
        """Create a virtual try-on task. Always async — returns a 202 with a
        taskId; poll with ``client.tasks.get``/``client.tasks.wait``."""
        body = {"userPhoto": user_photo, "productImage": product_image, "customPrompt": custom_prompt}
        body = {k: v for k, v in body.items() if v is not None}
        return self._transport.request("POST", "/v1/try-on", body=body)

    def variations(
        self,
        *,
        user_photo: str,
        product_image: str,
        pose_presets: Optional[List[Dict[str, Any]]] = None,
    ) -> dict:
        """Multi-pose variations from a single user + product pair. Also async."""
        body = {"userPhoto": user_photo, "productImage": product_image, "posePresets": pose_presets}
        body = {k: v for k, v in body.items() if v is not None}
        return self._transport.request("POST", "/v1/try-on/variations", body=body)
