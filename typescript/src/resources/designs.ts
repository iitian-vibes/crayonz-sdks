import type { Crayonz } from '../client';
import type { JobWaitOptions } from './jobs';
import type {
  DesignCustomRequest,
  DesignCustomResult,
  DesignGetResponse,
  DesignsListRequest,
  DesignsListResponse,
  JobQueuedResponse,
} from '../types';

export interface DesignsCreateOptions {
  /**
   * When true, sends `?async=0` and waits for the result in the same
   * request (only sensible for short calls — the server cuts a synchronous
   * request off past 100s). Default false: returns a 202 job immediately.
   */
  sync?: boolean;
}

export class DesignsResource {
  constructor(private readonly client: Crayonz) {}

  /**
   * Create a print-ready design from an idea. Async by default — returns a
   * queued job; poll it with `client.jobs.get`/`client.jobs.wait`, or pass
   * `{ sync: true }` to wait in-request. See {@link createAndWait} for the
   * common case of "just give me the finished design".
   */
  async create(
    params: DesignCustomRequest,
    options: DesignsCreateOptions = {},
  ): Promise<JobQueuedResponse | DesignCustomResult> {
    return this.client.request('POST', '/api/design/custom', {
      body: params,
      query: options.sync ? { async: 0 } : undefined,
    });
  }

  /**
   * Create a design and poll until it's done. Convenience wrapper over
   * `create` + `client.jobs.wait`.
   *
   * @example
   * const design = await client.designs.createAndWait({ idea: 'Retro skate shop logo' });
   * console.log(design.file_url);
   */
  async createAndWait(
    params: DesignCustomRequest,
    waitOptions?: JobWaitOptions,
  ): Promise<DesignCustomResult> {
    const queued = (await this.create(params)) as JobQueuedResponse;
    const job = await this.client.jobs.wait(queued.job_id, waitOptions);
    return job.result as DesignCustomResult;
  }

  /** List designs your key has generated, newest first. Free. */
  async list(params: DesignsListRequest = {}): Promise<DesignsListResponse> {
    return this.client.request('GET', '/api/designs', {
      query: { tag: params.tag, limit: params.limit },
    });
  }

  /** Fetch a single design by id. Free. */
  async get(designId: string): Promise<DesignGetResponse> {
    if (!designId) throw new Error('designId is required');
    return this.client.request('GET', `/api/designs/${encodeURIComponent(designId)}`);
  }
}
