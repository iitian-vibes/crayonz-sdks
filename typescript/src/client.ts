import { buildAPIError, CrayonzError } from './errors';
import type { CrayonzOptions } from './types';
import { DesignsResource } from './resources/designs';
import { JobsResource } from './resources/jobs';
import { MockupsResource } from './resources/mockups';
import { QualityResource } from './resources/quality';
import { PhotoshootsResource } from './resources/photoshoots';
import { TryOnResource } from './resources/try-on';
import { TasksResource } from './resources/tasks';
import { SizingResource } from './resources/sizing';
import { OutfitsResource } from './resources/outfits';
import { WebhooksResource } from './resources/webhooks';

export const DEFAULT_BASE_URL = 'https://api.crayonz.ai';
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RETRIES = 2;
const VERSION = '0.2.1';
export const USER_AGENT = `crayonz-node/${VERSION}`;

export type HttpMethod = 'GET' | 'POST' | 'DELETE';

export interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exponential backoff with jitter: 500ms, 1000ms, 2000ms, … +0-250ms. */
function backoffMs(attempt: number): number {
  const base = 500 * 2 ** attempt;
  const jitter = Math.random() * 250;
  return base + jitter;
}

/** Parses a Retry-After header: either delta-seconds or an HTTP-date. */
function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (!Number.isNaN(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return undefined;
}

function buildUrl(baseUrl: string, path: string, query?: RequestOptions['query']): string {
  const url = new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function getEnvApiKey(): string | undefined {
  // Node-only; browsers don't have `process`. Guarded so bundling for the
  // browser doesn't throw on load.
  try {
    return typeof process !== 'undefined' ? process.env?.CRAYONZ_API_KEY : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Crayonz API client.
 *
 * @example
 * import { Crayonz } from '@crayonz-ai/sdk';
 * const client = new Crayonz({ apiKey: process.env.CRAYONZ_API_KEY });
 * const design = await client.designs.createAndWait({ idea: 'Retro skate shop logo' });
 */
export class Crayonz {
  readonly designs: DesignsResource;
  readonly jobs: JobsResource;
  readonly mockups: MockupsResource;
  readonly quality: QualityResource;
  readonly photoshoots: PhotoshootsResource;
  readonly tryOn: TryOnResource;
  readonly tasks: TasksResource;
  readonly sizing: SizingResource;
  readonly outfits: OutfitsResource;
  readonly webhooks: WebhooksResource;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly tag: string | undefined;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: CrayonzOptions = {}) {
    const apiKey = opts.apiKey ?? getEnvApiKey();
    if (!apiKey) {
      throw new Error('apiKey is required (pass it, or set the CRAYONZ_API_KEY env var)');
    }
    if (!apiKey.startsWith('cz_live_') && !apiKey.startsWith('cz_test_')) {
      throw new Error('Invalid apiKey: must start with cz_live_ or cz_test_');
    }
    this.apiKey = apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeoutMs = opts.timeout ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.tag = opts.tag;
    this.fetchImpl = opts.fetch ?? globalThis.fetch;

    if (typeof this.fetchImpl !== 'function') {
      throw new Error('fetch is not available; pass `fetch` in options or run on Node 18+');
    }

    this.jobs = new JobsResource(this);
    this.designs = new DesignsResource(this);
    this.mockups = new MockupsResource(this);
    this.quality = new QualityResource(this);
    this.photoshoots = new PhotoshootsResource(this);
    this.tasks = new TasksResource(this);
    this.tryOn = new TryOnResource(this);
    this.sizing = new SizingResource(this);
    this.outfits = new OutfitsResource(this);
    this.webhooks = new WebhooksResource(this);
  }

  /**
   * Low-level request method used by every resource. Public so resources in
   * separate files can call it — not intended to be called directly, but
   * there's no harm in it (e.g. for an endpoint this SDK doesn't wrap yet).
   *
   * Retries on 429 and 5xx (respecting Retry-After) up to `maxRetries`
   * times, with exponential backoff + jitter. Never retries other 4xx.
   */
  async request<T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<T> {
    const url = buildUrl(this.baseUrl, path, options.query);
    const headers: Record<string, string> = {
      'X-API-Key': this.apiKey,
      'User-Agent': USER_AGENT,
    };
    if (this.tag) headers['X-Crayonz-Tag'] = this.tag;
    if (method === 'POST') headers['Content-Type'] = 'application/json';

    // A POST creates work and spends credits. If it timed out or the server
    // answered 5xx, the job may already be running and charged — sending it
    // again would run and bill it twice. So POSTs only retry a 429, which the
    // rate limiter answers before any work is done. GET/DELETE are safe to
    // repeat and retry on 429, 5xx and network errors.
    const idempotent = method !== 'POST';
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    for (;;) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      let resp: Response;
      try {
        resp = await this.fetchImpl(url, {
          method,
          headers,
          body: method === 'POST' ? JSON.stringify(options.body ?? {}) : undefined,
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timer);
        const isAbort = err instanceof Error && err.name === 'AbortError';
        if (idempotent && attempt < this.maxRetries) {
          attempt++;
          await sleep(backoffMs(attempt - 1));
          continue;
        }
        const message = isAbort
          ? `Request timed out after ${this.timeoutMs}ms`
          : `Network error: ${(err as Error).message}`;
        throw new CrayonzError(message, { status: 0, body: null, endpoint: path });
      }
      clearTimeout(timer);

      const text = await resp.text();
      let parsed: unknown = null;
      if (text) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text;
        }
      }

      if (resp.ok) return parsed as T;

      const retryAfterMs = parseRetryAfter(resp.headers.get('retry-after'));
      const isRetryable = resp.status === 429 || (idempotent && resp.status >= 500);

      if (isRetryable && attempt < this.maxRetries) {
        attempt++;
        await sleep(retryAfterMs ?? backoffMs(attempt - 1));
        continue;
      }

      throw buildAPIError(resp.status, parsed, path, retryAfterMs);
    }
  }
}
