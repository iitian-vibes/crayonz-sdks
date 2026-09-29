import type { Crayonz } from '../client';
import type { QualityScoreRequest, QualityScoreResult } from '../types';

export class QualityResource {
  constructor(private readonly client: Crayonz) {}

  /** Score a design 0-100 for printability, edge cleanliness and colour vibrancy. */
  async score(params: QualityScoreRequest): Promise<QualityScoreResult> {
    return this.client.request('POST', '/api/quality/score', { body: params });
  }
}
