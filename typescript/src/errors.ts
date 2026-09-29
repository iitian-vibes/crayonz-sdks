// Typed error hierarchy so consumers can `catch (e)` broadly with
// `e instanceof CrayonzError`, or narrowly with `e instanceof RateLimitError`
// etc. Every error carries the HTTP status, the parsed response body, and
// the endpoint that was called.

export interface CrayonzErrorOptions {
  status: number;
  body: unknown;
  endpoint: string;
}

export class CrayonzError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly endpoint: string;

  constructor(message: string, options: CrayonzErrorOptions) {
    super(message);
    this.name = 'CrayonzError';
    this.status = options.status;
    this.body = options.body;
    this.endpoint = options.endpoint;
    // Restore prototype chain for transpiled targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Base class for every error the API itself returned (as opposed to a
 * network failure or timeout, which is also a CrayonzError but not an
 * APIError). */
export class APIError extends CrayonzError {
  constructor(message: string, options: CrayonzErrorOptions) {
    super(message, options);
    this.name = 'APIError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 401 — missing, malformed, revoked or expired API key. */
export class AuthenticationError extends APIError {
  constructor(message: string, options: CrayonzErrorOptions) {
    super(message, options);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 402 — balance below the call's cost, or a per-key monthly spend cap hit
 * (`key_cap_exceeded`). Nothing was charged either way. */
export class InsufficientCreditsError extends APIError {
  constructor(message: string, options: CrayonzErrorOptions) {
    super(message, options);
    this.name = 'InsufficientCreditsError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 422 (or 400) — request validation failed. `errors` carries the raw
 * FastAPI-style `detail` array when the server sent one. */
export class ValidationError extends APIError {
  readonly errors?: unknown;

  constructor(message: string, options: CrayonzErrorOptions & { errors?: unknown }) {
    super(message, options);
    this.name = 'ValidationError';
    this.errors = options.errors;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 429 — rate limited. `retryAfter` (ms) is set when the server sent a
 * `Retry-After` header; the client already retried up to `maxRetries`
 * times before giving up and throwing this. */
export class RateLimitError extends APIError {
  readonly retryAfter?: number;

  constructor(message: string, options: CrayonzErrorOptions & { retryAfter?: number }) {
    super(message, options);
    this.name = 'RateLimitError';
    this.retryAfter = options.retryAfter;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Extracts a human-readable message from any of the API's error body
 * shapes: `{status,detail:string}`, `{detail:[{loc,msg,type}]}` (FastAPI
 * validation), `{error,message}` (customapi/VTO), `{status,error}` (5xx). */
export function extractErrorMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    if (typeof b.detail === 'string') return b.detail;
    if (Array.isArray(b.detail)) {
      const parts = b.detail.map((entry) => {
        if (entry && typeof entry === 'object') {
          const e = entry as Record<string, unknown>;
          const loc = Array.isArray(e.loc) ? e.loc.join('.') : undefined;
          const msg = typeof e.msg === 'string' ? e.msg : 'invalid';
          return loc ? `${loc}: ${msg}` : msg;
        }
        return String(entry);
      });
      if (parts.length) return parts.join('; ');
    }
    if (typeof b.message === 'string') return b.message;
    if (typeof b.error === 'string') return b.error;
  }
  return `Request failed with status ${status}`;
}

/** Builds the right typed error for an HTTP status + parsed body. */
export function buildAPIError(
  status: number,
  body: unknown,
  endpoint: string,
  retryAfter?: number,
): CrayonzError {
  const message = extractErrorMessage(body, status);
  const options: CrayonzErrorOptions = { status, body, endpoint };

  if (status === 401) return new AuthenticationError(message, options);
  if (status === 402) return new InsufficientCreditsError(message, options);
  if (status === 422 || status === 400) {
    const errors =
      body && typeof body === 'object' && Array.isArray((body as Record<string, unknown>).detail)
        ? (body as Record<string, unknown>).detail
        : undefined;
    return new ValidationError(message, { ...options, errors });
  }
  if (status === 429) return new RateLimitError(message, { ...options, retryAfter });
  return new APIError(message, options);
}
