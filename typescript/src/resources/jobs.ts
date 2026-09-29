import type { Crayonz } from '../client';
import { CrayonzError } from '../errors';
import type { JobGetResponse, JobStatus } from '../types';

export interface JobWaitOptions {
  /** Total time to keep polling before giving up, in ms. Default 300000 (5 min). */
  timeout?: number;
  /** Delay between polls, in ms. Default 3000. */
  interval?: number;
}

export class JobsResource {
  constructor(private readonly client: Crayonz) {}

  /** Poll a design-pipeline job (returned as job_id by e.g. designs.create). */
  async get(jobId: string): Promise<JobGetResponse> {
    if (!jobId) throw new Error('jobId is required');
    return this.client.request<JobGetResponse>('GET', `/api/jobs/${encodeURIComponent(jobId)}`);
  }

  /**
   * Poll a job until it reaches a terminal state. Resolves with the job
   * (job.result holds the endpoint's normal synchronous response shape).
   * Throws a CrayonzError if the job fails/cancels, or if it doesn't finish
   * within `timeout`.
   */
  async wait(jobId: string, options: JobWaitOptions = {}): Promise<JobStatus> {
    const timeout = options.timeout ?? 300_000;
    const interval = options.interval ?? 3_000;
    const deadline = Date.now() + timeout;
    const endpoint = `/api/jobs/${jobId}`;

    for (;;) {
      const { job } = await this.get(jobId);

      if (job.status === 'completed') return job;
      if (job.status === 'failed' || job.status === 'cancelled') {
        throw new CrayonzError(job.last_error ?? `Job ${jobId} ${job.status}`, {
          status: 0,
          body: job,
          endpoint,
        });
      }

      if (Date.now() >= deadline) {
        throw new CrayonzError(
          `Job ${jobId} did not reach a terminal state within ${timeout}ms (last status: ${job.status})`,
          { status: 0, body: job, endpoint },
        );
      }

      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }
}
