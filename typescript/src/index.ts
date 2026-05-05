// @crayonz-ai/sdk — Official TypeScript SDK for the Crayonz AI API.
//
// Quickstart:
//   import { Crayonz } from '@crayonz-ai/sdk';
//   const client = new Crayonz({ apiKey: process.env.CRAYONZ_API_KEY! });
//   const memes = await client.memes.generate({ topic: 'coding', count: 3 });

import { ClientBase } from './client-base';
import { MemesResource } from './resources/memes';
import { ContentResource } from './resources/content';
import { DesignResource } from './resources/design';
import type { CrayonzOptions } from './types';

export class Crayonz extends ClientBase {
  readonly memes: MemesResource;
  readonly content: ContentResource;
  readonly design: DesignResource;

  constructor(opts: CrayonzOptions) {
    super(opts);
    this.memes = new MemesResource(opts);
    this.content = new ContentResource(opts);
    this.design = new DesignResource(opts);
  }
}

export { CrayonzError } from './api-error';
export type {
  CrayonzOptions,
  ServiceUrls,
  Tone,
  MemeFormat,
  MemeGenerateRequest,
  MemeGenerateResponse,
  MemeResult,
  BlogGenerateRequest,
  BlogGenerateResponse,
  InstagramPostRequest,
  InstagramReelRequest,
  InstagramGeneralRequest,
  TrendsRequest,
  TrendsResponse,
  DesignGenerateRequest,
  DesignGenerateResponse,
  MockupRequest,
  CustomDesignRequest,
  QualityScoreRequest,
} from './types';
