import type { Crayonz } from '../client';
import type { TaskQueuedResponse, TryOnRequest, TryOnVariationsRequest } from '../types';

export class TryOnResource {
  constructor(private readonly client: Crayonz) {}

  /**
   * Create a virtual try-on task. Always async — returns a 202 with a
   * taskId; poll with `client.tasks.get`/`client.tasks.wait`.
   */
  async create(params: TryOnRequest): Promise<TaskQueuedResponse> {
    return this.client.request('POST', '/v1/try-on', { body: params });
  }

  /** Multi-pose variations from a single user + product pair. Also async. */
  async variations(params: TryOnVariationsRequest): Promise<TaskQueuedResponse> {
    return this.client.request('POST', '/v1/try-on/variations', { body: params });
  }
}
