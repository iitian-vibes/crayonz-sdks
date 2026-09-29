"""Official Python SDK for the Crayonz AI API.

Quickstart:

    from crayonz import Client

    client = Client(api_key="cz_live_...")
    design = client.designs.create_and_wait(idea="Retro skate shop logo")
    mockup = client.mockups.render(design_url=design["file_url"], garment="tshirt")
    print(mockup["mockup_url"])
"""
from ._client import Client
from ._exceptions import (
    APIError,
    AuthenticationError,
    CrayonzError,
    InsufficientCreditsError,
    RateLimitError,
    ValidationError,
)
from ._webhooks import verify_webhook_signature

__all__ = [
    "Client",
    "CrayonzError",
    "APIError",
    "AuthenticationError",
    "InsufficientCreditsError",
    "RateLimitError",
    "ValidationError",
    "verify_webhook_signature",
]
__version__ = "0.2.1"
