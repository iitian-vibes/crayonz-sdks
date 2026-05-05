import { ClientBase } from '../client-base';
import type {
  BlogGenerateRequest,
  BlogGenerateResponse,
  InstagramPostRequest,
  InstagramReelRequest,
  InstagramGeneralRequest,
} from '../types';

export class ContentResource extends ClientBase {
  /** Long-form SEO blog with research, sections, and atomized social copy. */
  async generateBlog(req: BlogGenerateRequest): Promise<BlogGenerateResponse> {
    return this.request<BlogGenerateResponse>('content', '/api/blog/generate', req);
  }

  /** Multi-slide Instagram carousel post. */
  async generatePost(req: InstagramPostRequest): Promise<unknown> {
    return this.request<unknown>('content', '/api/instagram/post', req);
  }

  /** Short-form video script for Instagram Reels / TikTok. */
  async generateReel(req: InstagramReelRequest): Promise<unknown> {
    return this.request<unknown>('content', '/api/instagram/reel', req);
  }

  /** General-purpose social copy across platforms. */
  async generateGeneral(req: InstagramGeneralRequest): Promise<unknown> {
    return this.request<unknown>('content', '/api/instagram/general', req);
  }
}
