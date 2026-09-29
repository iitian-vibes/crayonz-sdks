# @crayonz-ai/sdk

Official TypeScript / JavaScript SDK for the [Crayonz AI](https://crayonz.ai) API — print-ready AI design generation, garment mockups, model/product photoshoots, and virtual try-on.

```bash
npm install @crayonz-ai/sdk
```

Full API reference: https://crayonz.ai/api/docs · OpenAPI spec: https://crayonz.ai/api/openapi

## 60-second quickstart

```ts
import { Crayonz } from '@crayonz-ai/sdk';

const client = new Crayonz({ apiKey: process.env.CRAYONZ_API_KEY }); // or set CRAYONZ_API_KEY and omit apiKey

// 1. Create a design and wait for it to finish (createAndWait polls for you).
const design = await client.designs.createAndWait({
  idea: 'Retro 90s skate shop logo, bold outline',
  style_preferences: ['vintage'],
  target_products: ['tshirt'],
});
console.log(design.file_url); // print-ready, transparent PNG

// 2. Render it onto a real garment.
const mockup = await client.mockups.render({
  design_url: design.file_url,
  garment: 'tshirt',
  color: 'Black',
  view: 'front',
});
console.log(mockup.mockup_url);
```

That's the whole "idea → design → mockup" loop. `cz_test_*` keys are free and unmetered and return realistic fixtures; swap in a `cz_live_*` key to render for real.

## Client options

```ts
new Crayonz({
  apiKey: 'cz_live_...',       // falls back to process.env.CRAYONZ_API_KEY
  baseUrl: 'https://api.crayonz.ai', // override for a proxy/staging setup
  timeout: 60_000,             // per-request timeout, ms
  maxRetries: 2,               // retries on 429 and 5xx only, with backoff
  tag: 'project=launch',       // sent as X-Crayonz-Tag on every request; filter designs.list() by it
});
```

## Asynchronous jobs

`designs.create()` is **async by default**: it returns a 202 immediately —
`{ status: 'queued', job_id, poll_url }` — while the design renders in the
background (about 50s, occasionally longer). Poll it yourself, or use
`jobs.wait`:

```ts
const queued = await client.designs.create({ idea: 'A vintage badge' });
const job = await client.jobs.wait(queued.job_id, { timeout: 300_000, interval: 3_000 });
console.log(job.result.file_url);
```

`designs.createAndWait(...)` does exactly that in one call. Pass `{ sync: true }`
to `designs.create` instead to wait for the result **in the same HTTP request**
(`?async=0`) — only sensible for short calls, since the server cuts a
synchronous request off past 100s.

Virtual Try-On (`tryOn.create` / `tryOn.variations`) is async by nature and
always returns a 202 with a `taskId`; poll with `tasks.get` / `tasks.wait`.

## Error handling

Every non-2xx response raises a typed subclass of `CrayonzError`, carrying
`status`, `body` (the parsed response) and `endpoint`:

```ts
import {
  AuthenticationError,   // 401 — bad/missing/expired key
  InsufficientCreditsError, // 402 — balance too low, or a per-key spend cap hit
  ValidationError,       // 422/400 — bad request body; .errors has the field-level detail
  RateLimitError,        // 429 — retried automatically, thrown only after maxRetries
  APIError,              // everything else (403, 404, 500, 503, ...)
  CrayonzError,          // base class — also covers network errors/timeouts
} from '@crayonz-ai/sdk';

try {
  await client.designs.createAndWait({ idea: 'A logo' });
} catch (err) {
  if (err instanceof InsufficientCreditsError) {
    console.error('Out of credits:', err.message);
  } else if (err instanceof RateLimitError) {
    console.error('Rate limited, retry after', err.retryAfter, 'ms');
  } else if (err instanceof CrayonzError) {
    console.error(err.status, err.endpoint, err.body);
  }
}
```

Reads (`GET`, `DELETE`) are retried on 429, 5xx and network errors
(exponential backoff + jitter, honouring `Retry-After`) up to `maxRetries` times.
**Requests that create work (`POST`) are retried only on 429**, because a 429
is rejected before anything runs — after a timeout or a 5xx the job may
already be running and charged, and resending it could charge you twice. For
a design, poll `jobs.get` instead of resubmitting. Other 4xx responses are
never retried.

## Webhooks

Register an HTTPS endpoint from code (Starter plan and above, up to 5) or in the console:

```ts
const { webhook, secret } = await client.webhooks.create({
  url: 'https://example.com/crayonz',
  events: ['payment.completed', 'usage.threshold'],
});
// store `secret` — it is shown once. Later:
await client.webhooks.list();
await client.webhooks.delete(webhook.id);
```

Every delivery is a POST with the event name in `X-Crayonz-Event` and an HMAC-SHA256 hex digest of the raw
body, keyed on your webhook secret, in `X-Crayonz-Signature`. Verify it
before trusting the payload:

```ts
import { verifyWebhookSignature } from '@crayonz-ai/sdk';
import express from 'express';

const app = express();
app.post('/webhooks/crayonz', express.raw({ type: 'application/json' }), (req, res) => {
  const ok = verifyWebhookSignature(req.body, req.header('X-Crayonz-Signature'), process.env.CRAYONZ_WEBHOOK_SECRET!);
  if (!ok) return res.status(401).end();

  const event = JSON.parse(req.body.toString('utf8'));
  // event.event: 'usage.threshold' | 'key.rotated' | 'key.expired' | 'payment.completed' | 'plan.activated'
  res.status(200).end();
});
```

Verify against the **raw** request body — a re-serialized/parsed version can
differ byte-for-byte and make a legitimate delivery look forged. `client.webhooks.verify(...)`
is the same function, available on the client instance.

## Every resource

```ts
client.designs.create(params, { sync? });   // POST /api/design/custom
client.designs.createAndWait(params, waitOpts?);
client.designs.list({ tag?, limit? });       // GET  /api/designs
client.designs.get(designId);                // GET  /api/designs/{id}

client.jobs.get(jobId);                      // GET  /api/jobs/{job_id}
client.jobs.wait(jobId, { timeout?, interval? });

client.mockups.render(params);               // POST /api/mockup/render
client.quality.score(params);                // POST /api/quality/score

client.photoshoots.model(params);            // POST /api/photoshoot/v3/generate
client.photoshoots.product(params);          // POST /api/photoshoot/v3/generate-product
client.photoshoots.recommendVibes(params);   // POST /api/photoshoot/recommend-vibes

client.tryOn.create(params);                 // POST /v1/try-on
client.tryOn.variations(params);             // POST /v1/try-on/variations
client.tasks.get(taskId);                    // GET  /v1/tasks/{taskId}
client.tasks.wait(taskId, { timeout?, interval? });

client.sizing.recommend(params);             // POST /v1/size-recommendation
client.outfits.complete(params);             // POST /v1/complete-outfit
```

All request/response shapes are fully typed — see `src/types.ts` or your
editor's autocomplete.

## Migrating from 0.1.x

0.2.1 (the first 0.2 release) is a full rebuild targeting the *current* public API
(`api.crayonz.ai`) instead of the old internal meme/content/design services.
The meme, blog and Instagram-content resources (`client.memes`,
`client.content`) are **removed** — they were never part of the public
catalogue and are gone from this SDK. See `CHANGELOG.md`.

## License

MIT
