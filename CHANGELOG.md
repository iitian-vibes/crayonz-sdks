# Changelog

All notable changes to `@crayonz-ai/sdk` (npm) and `crayonz` (PyPI). Both packages are released in lockstep — the version below is the version on **both** registries.

The format is loosely [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] — 2026-09-29

Full rebuild around the **real, currently-live public API** at
`https://api.crayonz.ai` (see https://crayonz.ai/api/docs and the OpenAPI
spec at https://crayonz.ai/api/openapi). 0.1.x targeted an old internal
meme/content/design surface across three separate Cloud Run URLs that was
never the sold product — this release replaces it end to end.

### Breaking

- **Removed `client.memes` and `client.content` entirely** (meme generation,
  blog generation, Instagram post/reel/general). These were never part of
  the public catalogue and have no equivalent in this SDK. If you were
  using them, there is no migration path within this package — the
  meme/content services are internal tooling now.
- **Removed per-service `baseUrls` config** (`{ memes, content, design }` /
  `base_urls={"memes":...}`). Replaced with a single `baseUrl` / `base_url`
  pointing at the one gateway (`https://api.crayonz.ai`).
- **TypeScript: `CrayonzOptions.timeoutMs` renamed to `timeout`**, matching
  the Python client and the rest of the option names.
- **Python: `Client(api_key=...)` is no longer the only way in.** `api_key`
  is now optional and falls back to the `CRAYONZ_API_KEY` env var, matching
  the TypeScript client.

### Added

- **`webhooks.create` / `list` / `delete`** — manage delivery endpoints with
  your API key (`GET/POST /api/webhooks`, `DELETE /api/webhooks/{id}`;
  Starter plan and above, up to 5). `create` returns the signing secret once.
- **POST requests are never resent after a timeout or 5xx.** A POST creates
  work and spends credits; if it timed out or the server answered 5xx the job
  may already be running and billed, so resending could bill it twice. POSTs
  retry only a 429 (and, in Python, a connection that never opened). GET and
  DELETE retry 429, 5xx and network errors.
- **`designs`** — `create` (async 202 by default, or `sync=True`/`{sync:true}`
  for `?async=0`), `createAndWait`/`create_and_wait`, `list`, `get`. Wraps
  `POST /api/design/custom`, `GET /api/designs`, `GET /api/designs/{id}`.
- **`jobs`** — `get`, `wait` (polls `GET /api/jobs/{job_id}` until
  completed/failed/cancelled, or a timeout).
- **`mockups.render`** — `POST /api/mockup/render`.
- **`quality.score`** — `POST /api/quality/score`.
- **`photoshoots`** — `model`, `product`, `recommendVibes`/`recommend_vibes`.
  Wraps `POST /api/photoshoot/v3/generate`, `/generate-product`,
  `/recommend-vibes`.
- **`tryOn`/`try_on`** — `create`, `variations`. Wraps `POST /v1/try-on`,
  `/v1/try-on/variations` (both 202 + `taskId`).
- **`tasks`** — `get`, `wait`. Polls `GET /v1/tasks/{taskId}`.
- **`sizing.recommend`** — `POST /v1/size-recommendation`.
- **`outfits.complete`** — `POST /v1/complete-outfit`.
- **Typed error hierarchy**: `AuthenticationError` (401),
  `InsufficientCreditsError` (402 — covers both insufficient balance and
  `key_cap_exceeded`), `ValidationError` (422/400, carries the FastAPI
  `detail` array as `.errors`), `RateLimitError` (429, carries
  `retryAfter`/`retry_after`), `APIError` (everything else). All extend
  `CrayonzError`, which now also covers network/timeout failures.
- **Automatic retries** on 429 and 5xx only (never other 4xx), exponential
  backoff + jitter, honouring `Retry-After`. `maxRetries`/`max_retries`
  constructor option, default 2.
- **`webhooks.verify(rawBody, signature, secret)`** (also exported as
  `verifyWebhookSignature`/`verify_webhook_signature`) — constant-time
  HMAC-SHA256 verification of inbound `X-Crayonz-Signature` deliveries.
- Unit test suites with mocked HTTP for every resource, retry/backoff
  behaviour and webhook verification: `vitest` (TypeScript, 42 tests),
  `pytest` + `respx` (Python, 42 tests).
- User-Agent strings updated to `crayonz-node/0.2.0` and
  `crayonz-python/0.2.0`.

### Changed

- Single base URL (`https://api.crayonz.ai`) replaces the three
  hardcoded Cloud Run hostnames (`memeagent-*`, `content-api-*`,
  `design-api-*`) plus the customapi VTO host.
- Both SDKs now organise each endpoint group as its own resource module
  (`typescript/src/resources/*.ts`, `python/src/crayonz/resources/*.py`)
  instead of one flat client file, so a new endpoint is a new file + a test,
  not an edit to a growing monolith.

## [0.1.5] — 2026-05-05

### Added
- npm publish via OIDC Trusted Publishing — releases now require **zero secrets** on both npm and PyPI. (Workflow uses Node 24 / npm 11+ on the npm side.)
- `SECURITY.md` documenting the trust model, what's exposed, and recommended hardening.
- `scripts/bump.sh` helper for one-command releases.

### Changed
- Workflow upgraded from Node 20 (npm 10) to Node 24 (npm 11) — npm 10 signed provenance via OIDC but didn't auth the registry PUT via OIDC, causing 404. Fixed in npm 11.

## [0.1.0] — 2026-05-05

### Added
- Initial release of TypeScript SDK `@crayonz-ai/sdk` and Python SDK `crayonz`.
- Resources: `memes`, `content` (blog, post, reel, general), `design` (trends, generate, mockup, customize, score).
- `CrayonzError` typed error class on both languages.
- Cost-allocation tag support via `tag` constructor option (sends `X-Crayonz-Tag` header).
- `baseUrls` override option for self-hosted or staging deployments.
- TypeScript: dual ESM + CJS via tsup, full `.d.ts` types, Node 18+ native fetch, no runtime deps.
- Python: sync `httpx` client, context-manager support, Python 3.9+.

[Unreleased]: https://github.com/iitian-vibes/crayonz-sdks/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/iitian-vibes/crayonz-sdks/compare/v0.1.5...v0.2.0
[0.1.5]: https://github.com/iitian-vibes/crayonz-sdks/compare/v0.1.0...v0.1.5
[0.1.0]: https://github.com/iitian-vibes/crayonz-sdks/releases/tag/v0.1.0
