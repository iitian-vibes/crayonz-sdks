import type { Crayonz } from '../client';
import type { CompleteOutfitRequest, CompleteOutfitResult } from '../types';

export class OutfitsResource {
  constructor(private readonly client: Crayonz) {}

  /** Suggest complementary pieces for a base product to form a styled outfit. */
  async complete(params: CompleteOutfitRequest): Promise<CompleteOutfitResult> {
    return this.client.request('POST', '/v1/complete-outfit', { body: params });
  }
}
