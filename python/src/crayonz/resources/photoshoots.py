from __future__ import annotations

from typing import TYPE_CHECKING, Any, Dict, List, Optional

if TYPE_CHECKING:
    from .._client import _Transport


class PhotoshootsResource:
    def __init__(self, transport: "_Transport") -> None:
        self._transport = transport

    def model(
        self,
        *,
        design_reference_url: str,
        front_side: Optional[Dict[str, Any]] = None,
        back_side: Optional[Dict[str, Any]] = None,
        garment_type: Optional[str] = None,
        garment_color_hex: Optional[str] = None,
        garment_color_name: Optional[str] = None,
        pattern: Optional[str] = None,
        vibe: Optional[str] = None,
        shot_count: Optional[int] = None,
        shot_types: Optional[List[str]] = None,
        seed: Optional[int] = None,
    ) -> dict:
        """Editorial photos of a model wearing the design."""
        body = {
            "design_reference_url": design_reference_url,
            "front_side": front_side,
            "back_side": back_side,
            "garment_type": garment_type,
            "garment_color_hex": garment_color_hex,
            "garment_color_name": garment_color_name,
            "pattern": pattern,
            "vibe": vibe,
            "shot_count": shot_count,
            "shot_types": shot_types,
            "seed": seed,
        }
        body = {k: v for k, v in body.items() if v is not None}
        return self._transport.request("POST", "/api/photoshoot/v3/generate", body=body)

    def product(
        self,
        *,
        compositor_flatlay_url: str,
        shot_types: List[str],
        back_flatlay_url: Optional[str] = None,
        shot_sides: Optional[List[str]] = None,
        style_preset: Optional[str] = None,
        style_reference_url: Optional[str] = None,
        garment_type: Optional[str] = None,
        garment_color_hex: Optional[str] = None,
        garment_color_name: Optional[str] = None,
        seed: Optional[int] = None,
    ) -> dict:
        """Catalogue photos of the garment alone (packshots, flatlays, ...)."""
        body = {
            "compositor_flatlay_url": compositor_flatlay_url,
            "shot_types": shot_types,
            "back_flatlay_url": back_flatlay_url,
            "shot_sides": shot_sides,
            "style_preset": style_preset,
            "style_reference_url": style_reference_url,
            "garment_type": garment_type,
            "garment_color_hex": garment_color_hex,
            "garment_color_name": garment_color_name,
            "seed": seed,
        }
        body = {k: v for k, v in body.items() if v is not None}
        return self._transport.request("POST", "/api/photoshoot/v3/generate-product", body=body)

    def recommend_vibes(
        self,
        *,
        title: str,
        description: Optional[str] = None,
        top_k: Optional[int] = None,
        image_url: Optional[str] = None,
    ) -> dict:
        """Rank the model-photoshoot vibes that fit a design."""
        body = {"title": title, "description": description, "top_k": top_k, "image_url": image_url}
        body = {k: v for k, v in body.items() if v is not None}
        return self._transport.request("POST", "/api/photoshoot/recommend-vibes", body=body)
