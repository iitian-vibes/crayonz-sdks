import { createHmac } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { verifyWebhookSignature } from '../src/resources/webhooks';
import { Crayonz } from '../src/client';

const secret = 'whsec_test_secret';

function sign(body: string, key = secret): string {
  return createHmac('sha256', key).update(body).digest('hex');
}

describe('verifyWebhookSignature', () => {
  it('accepts a correctly signed payload', () => {
    const body = JSON.stringify({ event: 'usage.threshold', data: { pct: 80 }, delivered_at: 'now' });
    expect(verifyWebhookSignature(body, sign(body), secret)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const body = JSON.stringify({ event: 'usage.threshold', data: { pct: 80 } });
    const signature = sign(body);
    const tampered = JSON.stringify({ event: 'usage.threshold', data: { pct: 100 } });
    expect(verifyWebhookSignature(tampered, signature, secret)).toBe(false);
  });

  it('rejects a signature made with the wrong secret', () => {
    const body = JSON.stringify({ event: 'key.rotated', data: {} });
    expect(verifyWebhookSignature(body, sign(body, 'wrong_secret'), secret)).toBe(false);
  });

  it('rejects a missing signature', () => {
    expect(verifyWebhookSignature('{}', null, secret)).toBe(false);
    expect(verifyWebhookSignature('{}', undefined, secret)).toBe(false);
    expect(verifyWebhookSignature('{}', '', secret)).toBe(false);
  });

  it('rejects a signature of the wrong length without throwing', () => {
    expect(verifyWebhookSignature('{}', 'not-a-valid-length', secret)).toBe(false);
  });

  it('is available as client.webhooks.verify', () => {
    const client = new Crayonz({ apiKey: 'cz_test_abc', fetch: (async () => ({})) as unknown as typeof fetch });
    const body = JSON.stringify({ event: 'plan.activated', data: {} });
    expect(client.webhooks.verify(body, sign(body), secret)).toBe(true);
  });
});
