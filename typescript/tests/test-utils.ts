import { vi } from 'vitest';

export interface MockResponseSpec {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

/** Builds a fetch-compatible mock that answers a queue of responses in
 * order, and records every call made to it. */
export function mockFetch(responses: MockResponseSpec[]) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  let i = 0;

  const fn = vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const spec = responses[Math.min(i, responses.length - 1)];
    i++;
    const headers = new Headers(spec.headers ?? {});
    return {
      ok: spec.status >= 200 && spec.status < 300,
      status: spec.status,
      headers,
      text: async () => (spec.body === undefined ? '' : JSON.stringify(spec.body)),
    } as unknown as Response;
  });

  return { fn: fn as unknown as typeof fetch, calls };
}
