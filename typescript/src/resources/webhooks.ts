import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Crayonz } from '../client';

/** Events the API delivers. `'*'` subscribes to all of them. */
export type WebhookEvent = 'usage.threshold' | 'payment.completed' | 'plan.activated';

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  last_delivery_at: string | null;
  last_status: number | null;
  failure_count: number;
  created_at: string;
}

export interface WebhookCreateRequest {
  /** Your HTTPS endpoint. Private/internal hosts are rejected. */
  url: string;
  /** Defaults to all three events. */
  events?: Array<WebhookEvent | '*'>;
}

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

/** Register, list and remove webhooks (Starter plan and above, up to 5),
 * and verify deliveries. `verify` is local-only and makes no network call. */
export class WebhooksResource {
  constructor(private readonly client: Crayonz) {}

  /** Active webhooks on your account, plus the event names you can subscribe to. */
  async list(): Promise<{ status: 'ok'; events: WebhookEvent[]; webhooks: Webhook[] }> {
    return this.client.request('GET', '/api/webhooks');
  }

  /** Register an endpoint. The response's `secret` is shown ONCE — store it to verify deliveries. */
  async create(params: WebhookCreateRequest): Promise<{ status: 'ok'; webhook: Webhook; secret: string }> {
    return this.client.request('POST', '/api/webhooks', { body: params });
  }

  /** Stop deliveries to a webhook. */
  async delete(id: string): Promise<{ status: 'ok'; id: string; revoked: true }> {
    return this.client.request('DELETE', `/api/webhooks/${encodeURIComponent(id)}`);
  }

  verify(rawBody: string | Buffer, signature: string | null | undefined, secret: string): boolean {
    return verifyWebhookSignature(rawBody, signature, secret);
  }
}
