# crayonz

Official Python SDK for the [Crayonz AI](https://crayonz.ai) API — meme, content, and design generation.

## Install

```bash
pip install crayonz
```

## Quickstart

```python
from crayonz import Client

client = Client(api_key="cz_live_...")  # or os.environ["CRAYONZ_API_KEY"]

# Generate memes
memes = client.memes.generate(topic="coding", tone="sarcastic", count=3)
print(memes["memes"][0]["image_url"])

# Generate a blog post
blog = client.content.generate_blog(topic="campus life productivity", target_length=1500)

# Generate a design
design = client.design.generate(prompt="minimalist mountain logo", style="vector")
```

## Authentication

Get an API key at [crayonz.ai/api-console/keys](https://crayonz.ai/api-console/keys). Keys begin with `cz_live_` (production) or `cz_test_` (sandbox, free).

## Cost-allocation tags

Group usage across projects:

```python
client = Client(api_key="cz_live_...", tag="project=launch-campaign")
```

The tag shows up in the [usage dashboard](https://crayonz.ai/api-console/usage) under "By Tag".

## Error handling

```python
from crayonz import Client, CrayonzError

try:
    client.memes.generate(topic="x")
except CrayonzError as e:
    print(e.status, e.endpoint, e.body)
```

## Context manager

```python
with Client(api_key="cz_live_...") as client:
    trends = client.design.discover_trends(category="apparel")
```

## Configuration

```python
Client(
    api_key="cz_live_...",
    tag="project=foo",        # optional cost tag
    timeout=60.0,             # default 60s
    base_urls={               # override service URLs (rare)
        "memes": "https://...",
        "content": "https://...",
        "design": "https://...",
    },
)
```

## Requirements

Python 3.9+.

## License

MIT
