// Request and response types for the Crayonz API.
// Hand-written from the OpenAPI spec at https://crayonz.ai/api/openapi
// Don't add fields here that aren't in the spec — keep this thin.

export type Tone = 'sarcastic' | 'wholesome' | 'dark' | 'absurd' | 'relatable';
export type MemeFormat = 'template' | 'custom';

// ─── Memes ──────────────────────────────────────────────────
export interface MemeGenerateRequest {
  topic: string;
  tone?: Tone;
  count?: number;
  meme_format?: MemeFormat;
  audience?: string;
}

export interface MemeResult {
  template_id: string;
  template_name: string;
  image_url: string;
  caption_top?: string;
  caption_bottom?: string;
  score?: number;
}

export interface MemeGenerateResponse {
  success: boolean;
  memes: MemeResult[];
  error?: string | null;
  error_details?: string[];
  cost_usd?: number;
  rendered_count?: number;
  requested_count?: number;
}

// ─── Content ────────────────────────────────────────────────
export interface BlogGenerateRequest {
  topic: string;
  tone?: string;
  target_length?: number;
  blog_type?: string;
  generate_hero_image?: boolean;
  generate_section_images?: boolean;
  expert_quotes?: boolean;
}

export interface BlogGenerateResponse {
  blog: {
    id: string;
    title: string;
    slug: string;
    sections: Array<{ heading: string; content: string }>;
    word_count?: number;
    hero_image_url?: string | null;
  };
  cost_usd?: number;
}

export interface InstagramPostRequest {
  topic: string;
  slide_count?: number;
  tone?: string;
}
export interface InstagramReelRequest {
  topic: string;
  duration_seconds?: number;
}
export interface InstagramGeneralRequest {
  topic: string;
  platform?: 'instagram' | 'twitter' | 'linkedin';
}

// ─── Design ─────────────────────────────────────────────────
export interface TrendsRequest {
  category?: string;
  limit?: number;
}
export interface TrendsResponse {
  trends: Array<{ keyword: string; score: number; source?: string; momentum?: string }>;
  cost_usd?: number;
}

export interface DesignGenerateRequest {
  prompt: string;
  style?: string;
  colors?: string[];
}
export interface DesignGenerateResponse {
  design: {
    id: string;
    image_url: string;
    prompt_used?: string;
    style?: string;
    colors?: string[];
  };
  cost_usd?: number;
}

export interface MockupRequest {
  design_url: string;
  product?: string;
}
export interface CustomDesignRequest {
  base_design_url: string;
  instructions: string;
}
export interface QualityScoreRequest {
  design_url: string;
}

// ─── Virtual Try-On (VTO) ───────────────────────────────────
export interface VtoTryOnRequest {
  userPhoto: string;
  productImage: string;
  customPrompt?: string;
  webhookUrl?: string;
}
export interface VtoVariationsRequest extends VtoTryOnRequest {
  posePresets?: string[];
}
export interface VtoSizeRecommendationRequest {
  productImage: string;
  sizeChart: Record<string, unknown>;
  userMeasurements?: Record<string, unknown>;
}
export interface VtoCompleteOutfitRequest {
  baseProductImage: string;
  catalogImages?: string[];
}
export interface VtoTaskResponse {
  task_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  result_image?: string | null;
  result_images?: string[];
  reel_url?: string | null;
  error?: string | null;
}

// ─── Client config ──────────────────────────────────────────
export interface ServiceUrls {
  memes?: string;
  content?: string;
  design?: string;
  /** customapi backend that serves VTO endpoints. */
  vto?: string;
}

export interface CrayonzOptions {
  apiKey: string;
  /** Override per-service base URLs. Defaults point at production Cloud Run. */
  baseUrls?: ServiceUrls;
  /** Optional cost-allocation tag added to every request as X-Crayonz-Tag. */
  tag?: string;
  /** Override fetch (e.g. node-fetch) — defaults to global fetch. */
  fetch?: typeof fetch;
  /** Per-request timeout in ms. Default 60000. */
  timeoutMs?: number;
}
