import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Crayonz } from '../src/client';
import {
  AuthenticationError,
  InsufficientCreditsError,
  RateLimitError,
  ValidationError,
  APIError,
} from '../src/errors';
import { mockFetch } from './test-utils';

describe('Crayonz client construction', () => {
  it('throws when no apiKey and no env var', () => {
    const prev = process.env.CRAYONZ_API_KEY;
    delete process.env.CRAYONZ_API_KEY;
    expect(() => new Crayonz({ fetch: mockFetch([]).fn })).toThrow(/apiKey is required/);
    if (prev !== undefined) process.env.CRAYONZ_API_KEY = prev;
  });

  it('falls back to CRAYONZ_API_KEY env var', () => {
    const prev = process.env.CRAYONZ_API_KEY;
    process.env.CRAYONZ_API_KEY = 'cz_test_fromenv';
    const client = new Crayonz({ fetch: mockFetch([]).fn });
    expect(client).toBeInstanceOf(Crayonz);
    if (prev !== undefined) process.env.CRAYONZ_API_KEY = prev;
    else delete process.env.CRAYONZ_API_KEY;
  });

  it('rejects a key with the wrong prefix', () => {
    expect(() => new Crayonz({ apiKey: 'sk_live_nope', fetch: mockFetch([]).fn })).toThrow(
      /must start with cz_live_ or cz_test_/,
    );
  });

  it('accepts cz_test_ and cz_live_ prefixes', () => {
    expect(() => new Crayonz({ apiKey: 'cz_test_abc', fetch: mockFetch([]).fn })).not.toThrow();
    expect(() => new Crayonz({ apiKey: 'cz_live_abc', fetch: mockFetch([]).fn })).not.toThrow();
  });
});

describe('request headers', () => {
  it('sends X-API-Key, User-Agent, and Content-Type on POST', async () => {
    const { fn, calls } = mockFetch([{ status: 200, body: { ok: true } }]);
    const client = new Crayonz({ apiKey: 'cz_test_abc', fetch: fn });
    await client.mockups.render({ design_url: 'https://x/design.png', garment: 'tshirt' });

    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['X-API-Key']).toBe('cz_test_abc');
    expect(headers['User-Agent']).toMatch(/^crayonz-node\//);
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('sends X-Crayonz-Tag when a tag is configured', async () => {
    const { fn, calls } = mockFetch([{ status: 200, body: { ok: true } }]);
    const client = new Crayonz({ apiKey: 'cz_test_abc', tag: 'project=launch', fetch: fn });
    await client.mockups.render({ design_url: 'https://x/design.png', garment: 'tshirt' });
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['X-Crayonz-Tag']).toBe('project=launch');
  });

  it('omits Content-Type on GET requests', async () => {
    const { fn, calls } = mockFetch([{ status: 200, body: { status: 'ok', count: 0, designs: [] } }]);
    const client = new Crayonz({ apiKey: 'cz_test_abc', fetch: fn });
    await client.designs.list();
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
  });
});

describe('error mapping', () => {
  const cases: Array<[number, unknown, new (...args: never[]) => Error]> = [
    [401, { status: 'error', detail: 'invalid api key' }, AuthenticationError],
    [402, { status: 'error', detail: 'Insufficient credits: this call costs 18 and the balance is 6.' }, InsufficientCreditsError],
    [422, { detail: [{ loc: ['body', 'design_brief'], msg: 'Field required', type: 'missing' }] }, ValidationError],
    [403, { status: 'error', detail: 'missing scope: design-api:write' }, APIError],
    [404, { status: 'error', detail: 'no size chart for hoodiee' }, APIError],
    [500, { status: 'error', error: 'boom' }, APIError],
  ];

  it.each(cases)('maps HTTP %i to the right error class', async (status, body, ErrClass) => {
    const { fn } = mockFetch([{ status, body }]);
    const client = new Crayonz({ apiKey: 'cz_test_abc', fetch: fn, maxRetries: 0 });
    await expect(client.quality.score({ image_url: 'x', design_brief: 'y' })).rejects.toBeInstanceOf(
      ErrClass,
    );
  });

  it('extracts the message from a customapi-shaped body ({error,message})', async () => {
    const { fn } = mockFetch([{ status: 401, body: { error: 'Unauthorized', message: 'Invalid API key' } }]);
    const client = new Crayonz({ apiKey: 'cz_test_abc', fetch: fn, maxRetries: 0 });
    await expect(client.tryOn.create({ userPhoto: 'a', productImage: 'b' })).rejects.toThrow(
      'Invalid API key',
    );
  });

  it('joins FastAPI validation detail entries with their field path', async () => {
    const { fn } = mockFetch([
      { status: 422, body: { detail: [{ loc: ['body', 'design_brief'], msg: 'Field required', type: 'missing' }] } },
    ]);
    const client = new Crayonz({ apiKey: 'cz_test_abc', fetch: fn, maxRetries: 0 });
    await expect(client.quality.score({ image_url: 'x', design_brief: 'y' })).rejects.toThrow(
      'body.design_brief: Field required',
    );
  });

  it('carries status, body and endpoint on the thrown error', async () => {
    const body = { status: 'error', detail: 'no size chart for hoodiee' };
    const { fn } = mockFetch([{ status: 404, body }]);
    const client = new Crayonz({ apiKey: 'cz_test_abc', fetch: fn, maxRetries: 0 });
    try {
      await client.mockups.render({ design_url: 'x', garment: 'hoodiee' });
      expect.unreachable();
    } catch (err) {
      const e = err as APIError;
      expect(e.status).toBe(404);
      expect(e.body).toEqual(body);
      expect(e.endpoint).toBe('/api/mockup/render');
    }
  });
});

describe('retries', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries a 429 up to maxRetries and succeeds on the final attempt', async () => {
    const { fn, calls } = mockFetch([
      { status: 429, body: { status: 'error', detail: 'rate limit exceeded' }, headers: { 'retry-after': '0' } },
      { status: 429, body: { status: 'error', detail: 'rate limit exceeded' }, headers: { 'retry-after': '0' } },
      { status: 200, body: { status: 'ok', count: 0, designs: [] } },
    ]);
    const client = new Crayonz({ apiKey: 'cz_test_abc', fetch: fn, maxRetries: 2 });

    const promise = client.designs.list();
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({ status: 'ok', count: 0, designs: [] });
    expect(calls.length).toBe(3);
  });

  it('gives up after maxRetries and throws RateLimitError with retryAfter', async () => {
    const { fn, calls } = mockFetch([
      { status: 429, body: { status: 'error', detail: 'rate limit exceeded' }, headers: { 'retry-after': '2' } },
    ]);
    const client = new Crayonz({ apiKey: 'cz_test_abc', fetch: fn, maxRetries: 1 });

    const promise = client.designs.list();
    const assertion = expect(promise).rejects.toBeInstanceOf(RateLimitError);
    await vi.runAllTimersAsync();
    await assertion;
    expect(calls.length).toBe(2); // 1 initial + 1 retry
  });

  it('retries a 500 but never retries a 404', async () => {
    const { fn: fn500, calls: calls500 } = mockFetch([
      { status: 500, body: { status: 'error', error: 'boom' } },
      { status: 200, body: { status: 'ok', count: 0, designs: [] } },
    ]);
    const client500 = new Crayonz({ apiKey: 'cz_test_abc', fetch: fn500, maxRetries: 2 });
    const p1 = client500.designs.list();
    await vi.runAllTimersAsync();
    await p1;
    expect(calls500.length).toBe(2);

    const { fn: fn404, calls: calls404 } = mockFetch([
      { status: 404, body: { status: 'error', detail: 'not found' } },
      { status: 200, body: { status: 'ok', count: 0, designs: [] } },
    ]);
    const client404 = new Crayonz({ apiKey: 'cz_test_abc', fetch: fn404, maxRetries: 2 });
    await expect(client404.designs.list()).rejects.toBeInstanceOf(APIError);
    expect(calls404.length).toBe(1); // no retry on 404
  });
});

describe('query params', () => {
  it('appends ?async=0 when designs.create is called with { sync: true }', async () => {
    const { fn, calls } = mockFetch([
      { status: 200, body: { status: 'success', design_id: 'd1', file_url: 'https://x/d.png', print_ready: true } },
    ]);
    const client = new Crayonz({ apiKey: 'cz_test_abc', fetch: fn });
    await client.designs.create({ idea: 'a logo' }, { sync: true });
    expect(calls[0].url).toContain('async=0');
  });

  it('does not append async param by default', async () => {
    const { fn, calls } = mockFetch([
      { status: 202, body: { status: 'queued', job_id: 'j1', poll_url: '/api/jobs/j1' } },
    ]);
    const client = new Crayonz({ apiKey: 'cz_test_abc', fetch: fn });
    await client.designs.create({ idea: 'a logo' });
    expect(calls[0].url).not.toContain('async=');
  });

  it('sends tag and limit as query params on designs.list', async () => {
    const { fn, calls } = mockFetch([{ status: 200, body: { status: 'ok', count: 0, designs: [] } }]);
    const client = new Crayonz({ apiKey: 'cz_test_abc', fetch: fn });
    await client.designs.list({ tag: 'project=launch', limit: 10 });
    expect(calls[0].url).toContain('tag=project%3Dlaunch');
    expect(calls[0].url).toContain('limit=10');
  });
});
