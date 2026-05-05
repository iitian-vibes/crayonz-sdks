import { ClientBase } from '../client-base';
import type {
  TrendsRequest,
  TrendsResponse,
  DesignGenerateRequest,
  DesignGenerateResponse,
  MockupRequest,
  CustomDesignRequest,
  QualityScoreRequest,
} from '../types';

export class DesignResource extends ClientBase {
  /** Surface trending design themes for college merchandise. */
  async discoverTrends(req: TrendsRequest = {}): Promise<TrendsResponse> {
    return this.request<TrendsResponse>('design', '/api/trends/discover', req);
  }

  /** Generate a print-ready design from a text prompt. */
  async generate(req: DesignGenerateRequest): Promise<DesignGenerateResponse> {
    return this.request<DesignGenerateResponse>('design', '/api/design/generate', req);
  }

  /** Place a design onto an apparel mockup. */
  async generateMockup(req: MockupRequest): Promise<unknown> {
    return this.request<unknown>('design', '/api/mockup/generate', req);
  }

  /** Iterate on an existing design with new instructions. */
  async customize(req: CustomDesignRequest): Promise<unknown> {
    return this.request<unknown>('design', '/api/design/custom', req);
  }

  /** Quality and printability score for a design. */
  async score(req: QualityScoreRequest): Promise<unknown> {
    return this.request<unknown>('design', '/api/quality/score', req);
  }
}
