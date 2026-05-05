import { ClientBase } from '../client-base';
import type {
  VtoTryOnRequest,
  VtoVariationsRequest,
  VtoSizeRecommendationRequest,
  VtoCompleteOutfitRequest,
  VtoTaskResponse,
} from '../types';

export class VtoResource extends ClientBase {
  /**
   * Create a virtual try-on task. Async — poll {@link getTask} for the
   * `result_image` once `status === 'completed'`.
   */
  async tryOn(req: VtoTryOnRequest): Promise<VtoTaskResponse> {
    return this.request<VtoTaskResponse>('vto', '/v1/try-on', req);
  }

  /**
   * Multi-pose variations from a single user + product pair.
   * Returns an array of result image URLs in `result_images`.
   */
  async variations(req: VtoVariationsRequest): Promise<VtoTaskResponse> {
    return this.request<VtoTaskResponse>('vto', '/v1/try-on/variations', req);
  }

  /**
   * AI size recommendation — pass the product image and a size chart.
   */
  async sizeRecommendation(req: VtoSizeRecommendationRequest): Promise<unknown> {
    return this.request<unknown>('vto', '/v1/size-recommendation', req);
  }

  /**
   * "Complete the outfit" — given a base product, suggest pairings.
   */
  async completeOutfit(req: VtoCompleteOutfitRequest): Promise<unknown> {
    return this.request<unknown>('vto', '/v1/complete-outfit', req);
  }

  /**
   * Poll a task by id. Returns the current `status` plus result fields
   * once `completed`.
   *
   * Note: VTO's task endpoint is GET, but our base client only supports
   * POST. This helper does the GET directly to keep the API ergonomic.
   */
  async getTask(taskId: string): Promise<VtoTaskResponse> {
    if (!taskId) throw new Error('taskId required');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseUrls = (this as any).baseUrls;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apiKey = (this as any).apiKey;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetchImpl = (this as any).fetchImpl as typeof fetch;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const timeoutMs = (this as any).timeoutMs as number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tag = (this as any).tag as string | undefined;
    const url = `${baseUrls.vto}/v1/tasks/${encodeURIComponent(taskId)}`;
    const headers: Record<string, string> = {
      'X-API-Key': apiKey,
      'User-Agent': '@crayonz-ai/sdk',
    };
    if (tag) headers['X-Crayonz-Tag'] = tag;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const resp = await fetchImpl(url, { headers, signal: ctrl.signal });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) {
        throw new Error(`VTO task fetch failed: ${resp.status}`);
      }
      return data as VtoTaskResponse;
    } finally {
      clearTimeout(t);
    }
  }
}
