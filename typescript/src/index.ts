// @crayonz-ai/sdk — Official TypeScript SDK for the Crayonz AI API.
//
// Quickstart:
//   import { Crayonz } from '@crayonz-ai/sdk';
//   const client = new Crayonz({ apiKey: process.env.CRAYONZ_API_KEY });
//   const design = await client.designs.createAndWait({ idea: 'Retro skate shop logo' });
//   const mockup = await client.mockups.render({ design_url: design.file_url, garment: 'tshirt' });

export { Crayonz, DEFAULT_BASE_URL } from './client';

export {
  CrayonzError,
  APIError,
  AuthenticationError,
  InsufficientCreditsError,
  RateLimitError,
  ValidationError,
} from './errors';

export { verifyWebhookSignature } from './resources/webhooks';

export type { JobWaitOptions } from './resources/jobs';
export type { TaskWaitOptions } from './resources/tasks';
export type { DesignsCreateOptions } from './resources/designs';

export type {
  CrayonzOptions,
  DesignCustomRequest,
  DesignCustomResult,
  DesignReferences,
  JobQueuedResponse,
  JobStatus,
  JobStatusValue,
  JobGetResponse,
  DesignRow,
  DesignsListRequest,
  DesignsListResponse,
  DesignGetResponse,
  MockupRenderRequest,
  MockupRenderResult,
  QualityScoreRequest,
  QualityScores,
  QualityScoreResult,
  PhotoshootSide,
  PhotoshootModelRequest,
  PhotoshootModelShot,
  PhotoshootModelResult,
  PhotoshootProductRequest,
  PhotoshootProductShot,
  PhotoshootProductResult,
  RecommendVibesRequest,
  VibeRecommendation,
  RecommendVibesResult,
  TryOnRequest,
  PosePreset,
  TryOnVariationsRequest,
  TaskStatusValue,
  TaskQueuedResponse,
  TaskResultImage,
  TaskGetResponse,
  SizeRecommendationRequest,
  SizeRecommendationResult,
  CompleteOutfitRequest,
  OutfitSuggestion,
  CompleteOutfitResult,
} from './types';
