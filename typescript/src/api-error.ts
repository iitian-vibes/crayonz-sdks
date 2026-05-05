// Single error type so consumers can `catch (e)` with a `e instanceof CrayonzError` check.

export class CrayonzError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly endpoint: string;

  constructor(message: string, options: { status: number; body: unknown; endpoint: string }) {
    super(message);
    this.name = 'CrayonzError';
    this.status = options.status;
    this.body = options.body;
    this.endpoint = options.endpoint;
  }
}
