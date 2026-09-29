import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verifies an inbound Crayonz webhook delivery.
 *
 * Every delivery is a POST with the event name in `X-Crayonz-Event` and an
 * HMAC-SHA256 hex digest of the *raw* request body, keyed on your webhook
 * secret, in `X-Crayonz-Signature`. Always verify against the raw bytes —
 * not a re-serialized/parsed version, which can differ byte-for-byte and
 * make a legitimate delivery look forged.
 *
 * @example
 * // Express, with a raw body parser on this route:
 * const ok = verifyWebhookSignature(req.body, req.header('X-Crayonz-Signature'), secret);
 * if (!ok) return res.status(401).end();
 */
export function verifyWebhookSignature(
  rawBody: string | Buffer,
  signature: string | null | undefined,
  secret: string,
): boolean {
  if (!signature || !secret) return false;

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const actualBuf = Buffer.from(signature, 'utf8');

  // timingSafeEqual throws on length mismatch — that's still a "no match",
  // just handled explicitly rather than letting it throw.
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

/** Instance-bound wrapper so `client.webhooks.verify(...)` reads naturally
 * alongside the other resources, even though verification is local-only
 * and makes no network call. */
export class WebhooksResource {
  verify(rawBody: string | Buffer, signature: string | null | undefined, secret: string): boolean {
    return verifyWebhookSignature(rawBody, signature, secret);
  }
}
