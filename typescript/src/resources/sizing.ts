import type { Crayonz } from '../client';
import type { SizeRecommendationRequest, SizeRecommendationResult } from '../types';

export class SizingResource {
  constructor(private readonly client: Crayonz) {}

  /** AI size recommendation from a product (or shopper) image + a size chart. */
  async recommend(params: SizeRecommendationRequest): Promise<SizeRecommendationResult> {
    return this.client.request('POST', '/v1/size-recommendation', { body: params });
  }
}
