# crayonz

Official Python SDK for the [Crayonz AI](https://crayonz.ai) API — print-ready AI design generation, garment mockups, model/product photoshoots, and virtual try-on.

```bash
pip install crayonz
```

Full API reference: https://crayonz.ai/api/docs · OpenAPI spec: https://crayonz.ai/api/openapi

## 60-second quickstart

```python
from crayonz import Client

client = Client(api_key="cz_live_...")  # or set CRAYONZ_API_KEY and omit api_key

# 1. Create a design and wait for it to finish (create_and_wait polls for you).
design = client.designs.create_and_wait(
    idea="Retro 90s skate shop logo, bold outline",
    style_preferences=["vintage"],
    target_products=["tshirt"],
)
print(design["file_url"])  # print-ready, transparent PNG

# 2. Render it onto a real garment.
mockup = client.mockups.render(design_url=design["file_url"], garment="tshirt", color="Black", view="front")
print(mockup["mockup_url"])

client.close()
```

Or as a context manager:

```python
with Client(api_key="cz_live_...") as client:
    design = client.designs.create_and_wait(idea="Retro skate shop logo")
```

`cz_test_*` keys are free and unmetered and return realistic fixtures; swap
in a `cz_live_*` key to render for real.

## Client options

```python
Client(
    api_key="cz_live_...",             # falls back to the CRAYONZ_API_KEY env var
    base_url="https://api.crayonz.ai", # override for a proxy/staging setup
    timeout=60.0,                      # per-request timeout, seconds
    max_retries=2,                     # retries on 429 and 5xx only, with backoff
    tag="project=launch",              # sent as X-Crayonz-Tag on every request
)
```

## Asynchronous jobs

`designs.create()` is **async by default**: it returns a 202 immediately —
`{"status": "queued", "job_id": ..., "poll_url": ...}` — while the design
renders in the background (about 50s, occasionally longer). Poll it
yourself, or use `jobs.wait`:

```python
queued = client.designs.create(idea="A vintage badge")
job = client.jobs.wait(queued["job_id"], timeout=300.0, interval=3.0)
print(job["result"]["file_url"])
```

`designs.create_and_wait(...)` does exactly that in one call. Pass `sync=True`
to `designs.create` instead to wait for the result **in the same HTTP
request** (`?async=0`) — only sensible for short calls, since the server
cuts a synchronous request off past 100s.

Virtual Try-On (`try_on.create` / `try_on.variations`) is async by nature and
always returns a 202 with a `taskId`; poll with `tasks.get` / `tasks.wait`.

## Error handling

Every non-2xx response raises a typed subclass of `CrayonzError`, carrying
`.status`, `.body` (the parsed response) and `.endpoint`:

```python
from crayonz import (
    AuthenticationError,      # 401 — bad/missing/expired key
    InsufficientCreditsError, # 402 — balance too low, or a per-key spend cap hit
    ValidationError,          # 422/400 — bad request body; .errors has the field-level detail
    RateLimitError,           # 429 — retried automatically, raised only after max_retries
    APIError,                 # everything else (403, 404, 500, 503, ...)
    CrayonzError,             # base class — also covers network errors/timeouts
)

try:
    design = client.designs.create_and_wait(idea="A logo")
except InsufficientCreditsError as e:
    print("Out of credits:", e)
except RateLimitError as e:
    print("Rate limited, retry after", e.retry_after, "seconds")
except CrayonzError as e:
    print(e.status, e.endpoint, e.body)
```

Reads (`GET`, `DELETE`) are retried on 429, 5xx and network errors
(exponential backoff + jitter, honouring `Retry-After`) up to `max_retries` times.
**Requests that create work (`POST`) are retried only on 429**, because a 429
is rejected before anything runs — after a timeout or a 5xx the job may
already be running and charged, and resending it could charge you twice. For
a design, poll `jobs.get` instead of resubmitting. Other 4xx responses are
never retried.

## Webhooks

Register an HTTPS endpoint from code (Starter plan and above, up to 5) or in the console:

```python
created = client.webhooks.create("https://example.com/crayonz", events=["payment.completed", "usage.threshold"])
secret = created["secret"]  # shown once — store it
client.webhooks.list()
client.webhooks.delete(created["webhook"]["id"])
```

Every delivery is a POST with the event name in `X-Crayonz-Event` and an HMAC-SHA256 hex digest of the raw
body, keyed on your webhook secret, in `X-Crayonz-Signature`. Verify it
before trusting the payload:

```python
from crayonz import verify_webhook_signature
from flask import Flask, request, abort

app = Flask(__name__)

@app.post("/webhooks/crayonz")
def crayonz_webhook():
    raw = request.get_data()  # raw bytes — not request.json
    ok = verify_webhook_signature(raw, request.headers.get("X-Crayonz-Signature"), WEBHOOK_SECRET)
    if not ok:
        abort(401)
    event = request.get_json()
    # event["event"]: usage.threshold | key.rotated | key.expired | payment.completed | plan.activated
    return "", 200
```

Verify against the **raw** request body — a re-serialized/parsed version can
differ byte-for-byte and make a legitimate delivery look forged.
`client.webhooks.verify(...)` is the same function, available on the client
instance.

## Every resource

```python
client.designs.create(idea=..., sync=False, **kwargs)   # POST /api/design/custom
client.designs.create_and_wait(idea=..., **kwargs)
client.designs.list(tag=None, limit=None)                # GET  /api/designs
client.designs.get(design_id)                             # GET  /api/designs/{id}

client.jobs.get(job_id)                                    # GET  /api/jobs/{job_id}
client.jobs.wait(job_id, timeout=300.0, interval=3.0)

client.mockups.render(design_url=..., garment=..., **kwargs)  # POST /api/mockup/render
client.quality.score(image_url=..., design_brief=..., **kwargs)  # POST /api/quality/score

client.photoshoots.model(design_reference_url=..., **kwargs)     # POST /api/photoshoot/v3/generate
client.photoshoots.product(compositor_flatlay_url=..., shot_types=[...])  # POST /api/photoshoot/v3/generate-product
client.photoshoots.recommend_vibes(title=..., **kwargs)          # POST /api/photoshoot/recommend-vibes

client.try_on.create(user_photo=..., product_image=..., **kwargs)     # POST /v1/try-on
client.try_on.variations(user_photo=..., product_image=..., **kwargs) # POST /v1/try-on/variations
client.tasks.get(task_id)                                              # GET  /v1/tasks/{taskId}
client.tasks.wait(task_id, timeout=180.0, interval=3.0)

client.sizing.recommend(image=..., size_chart=..., **kwargs)  # POST /v1/size-recommendation
client.outfits.complete(product_images=[...], **kwargs)       # POST /v1/complete-outfit
```

Every method returns a plain `dict` matching the API's JSON response — see
https://crayonz.ai/api/docs for the exact shape of each.

## Migrating from 0.1.x

0.2.1 (the first 0.2 release) is a full rebuild targeting the *current* public API
(`api.crayonz.ai`) instead of the old internal meme/content/design services.
The meme, blog and Instagram-content resources (`client.memes`,
`client.content`) are **removed** — they were never part of the public
catalogue and are gone from this SDK. See `CHANGELOG.md`.

## License

MIT
