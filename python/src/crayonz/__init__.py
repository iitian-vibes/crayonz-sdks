"""Official Python SDK for the Crayonz AI API.

Quickstart:

    from crayonz import Client

    client = Client(api_key="cz_live_...")
    memes = client.memes.generate(topic="coding", tone="sarcastic", count=3)
    print(memes["memes"][0]["image_url"])
"""
from ._client import Client
from ._exceptions import CrayonzError

__all__ = ["Client", "CrayonzError"]
__version__ = "0.2.0"
