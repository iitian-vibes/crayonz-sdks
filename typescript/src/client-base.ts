import { CrayonzError } from './api-error';
import type { CrayonzOptions, ServiceUrls } from './types';

const DEFAULT_BASE_URLS: Required<ServiceUrls> = {
  memes: 'https://memeagent-199406543652.asia-south1.run.app',
  content: 'https://content-api-199406543652.asia-south1.run.app',
  design: 'https://design-api-199406543652.asia-south1.run.app',
  vto: 'https://customapi-199406543652.asia-south1.run.app',
};

export type ServiceKey = keyof ServiceUrls;

export class ClientBase {
  protected readonly apiKey: string;
  protected readonly baseUrls: Required<ServiceUrls>;
  protected readonly tag: string | undefined;
  protected readonly fetchImpl: typeof fetch;
  protected readonly timeoutMs: number;

  constructor(opts: CrayonzOptions) {
    if (!opts.apiKey) {
      throw new Error('apiKey is required (e.g. process.env.CRAYONZ_API_KEY)');
    }
    if (!opts.apiKey.startsWith('cz_live_') && !opts.apiKey.startsWith('cz_test_')) {
      throw new Error('Invalid apiKey: must start with cz_live_ or cz_test_');
    }
    this.apiKey = opts.apiKey;
    this.baseUrls = { ...DEFAULT_BASE_URLS, ...(opts.baseUrls ?? {}) };
    this.tag = opts.tag;
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
    this.timeoutMs = opts.timeoutMs ?? 60_000;

    if (typeof this.fetchImpl !== 'function') {
      throw new Error('fetch is not available; pass `fetch` in options or run on Node 18+');
    }
  }

  protected async request<T>(service: ServiceKey, path: string, body: unknown): Promise<T> {
    const baseUrl = this.baseUrls[service];
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
      'User-Agent': '@crayonz-ai/sdk',
    };
    if (this.tag) headers['X-Crayonz-Tag'] = this.tag;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let resp: Response;
    try {
      resp = await this.fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new CrayonzError(`Request timed out after ${this.timeoutMs}ms`, {
          status: 0,
          body: null,
          endpoint: path,
        });
      }
      throw new CrayonzError(`Network error: ${(err as Error).message}`, {
        status: 0,
        body: null,
        endpoint: path,
      });
    }
    clearTimeout(timer);

    let parsed: unknown = null;
    try {
      parsed = await resp.json();
    } catch {
      // non-JSON; leave parsed=null and fall through to error path
    }

    if (!resp.ok) {
      const message =
        (parsed && typeof parsed === 'object' && 'detail' in parsed && typeof parsed.detail === 'string'
          ? parsed.detail
          : null) ??
        (parsed && typeof parsed === 'object' && 'error' in parsed && typeof parsed.error === 'string'
          ? parsed.error
          : null) ??
        `Request failed with status ${resp.status}`;
      throw new CrayonzError(message, {
        status: resp.status,
        body: parsed,
        endpoint: path,
      });
    }

    return parsed as T;
  }
}
