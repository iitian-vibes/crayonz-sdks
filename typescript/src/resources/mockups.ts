import type { Crayonz } from '../client';
import type { MockupRenderRequest, MockupRenderResult } from '../types';

export class MockupsResource {
  constructor(private readonly client: Crayonz) {}

  /** Render a design onto a real garment template, in a real colour. */
  async render(params: MockupRenderRequest): Promise<MockupRenderResult> {
    return this.client.request('POST', '/api/mockup/render', { body: params });
  }
}
