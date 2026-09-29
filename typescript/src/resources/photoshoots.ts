import type { Crayonz } from '../client';
import type {
  PhotoshootModelRequest,
  PhotoshootModelResult,
  PhotoshootProductRequest,
  PhotoshootProductResult,
  RecommendVibesRequest,
  RecommendVibesResult,
} from '../types';

export class PhotoshootsResource {
  constructor(private readonly client: Crayonz) {}

  /** Editorial photos of a model wearing the design. */
  async model(params: PhotoshootModelRequest): Promise<PhotoshootModelResult> {
    return this.client.request('POST', '/api/photoshoot/v3/generate', { body: params });
  }

  /** Catalogue photos of the garment alone (packshots, flatlays, …). */
  async product(params: PhotoshootProductRequest): Promise<PhotoshootProductResult> {
    return this.client.request('POST', '/api/photoshoot/v3/generate-product', { body: params });
  }

  /** Rank the model-photoshoot vibes that fit a design. */
  async recommendVibes(params: RecommendVibesRequest): Promise<RecommendVibesResult> {
    return this.client.request('POST', '/api/photoshoot/recommend-vibes', { body: params });
  }
}
