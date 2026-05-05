import { ClientBase } from '../client-base';
import type { MemeGenerateRequest, MemeGenerateResponse } from '../types';

export class MemesResource extends ClientBase {
  /**
   * Generate AI memes using Imgflip templates and Gemini brainstorming.
   *
   * @example
   * const out = await client.memes.generate({ topic: 'coding', tone: 'sarcastic', count: 3 });
   * console.log(out.memes[0].image_url);
   */
  async generate(req: MemeGenerateRequest): Promise<MemeGenerateResponse> {
    return this.request<MemeGenerateResponse>('memes', '/generate', req);
  }
}
