import type { Crayonz } from '../client';
import { CrayonzError } from '../errors';
import type { TaskGetResponse } from '../types';

export interface TaskWaitOptions {
  /** Total time to keep polling before giving up, in ms. Default 180000 (3 min). */
  timeout?: number;
  /** Delay between polls, in ms. Default 3000. */
  interval?: number;
}

export class TasksResource {
  constructor(private readonly client: Crayonz) {}

  /** Poll a Virtual Try-On task by id (returned as taskId by tryOn.create/variations). */
  async get(taskId: string): Promise<TaskGetResponse> {
    if (!taskId) throw new Error('taskId is required');
    return this.client.request<TaskGetResponse>('GET', `/v1/tasks/${encodeURIComponent(taskId)}`);
  }

  /** Poll a task until it completes or fails. Resolves with the completed task. */
  async wait(taskId: string, options: TaskWaitOptions = {}): Promise<TaskGetResponse> {
    const timeout = options.timeout ?? 180_000;
    const interval = options.interval ?? 3_000;
    const deadline = Date.now() + timeout;
    const endpoint = `/v1/tasks/${taskId}`;

    for (;;) {
      const task = await this.get(taskId);

      if (task.status === 'completed') return task;
      if (task.status === 'failed') {
        throw new CrayonzError(task.error ?? `Task ${taskId} failed`, {
          status: 0,
          body: task,
          endpoint,
        });
      }

      if (Date.now() >= deadline) {
        throw new CrayonzError(
          `Task ${taskId} did not complete within ${timeout}ms (last status: ${task.status})`,
          { status: 0, body: task, endpoint },
        );
      }

      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }
}
