// Request and response types for the Crayonz API.
// Hand-written from the live OpenAPI spec at https://crayonz.ai/api/openapi
// and the reference docs at https://crayonz.ai/api/docs. Keep this in sync
// with those two — don't add fields that aren't in the spec.

// ─── Client config ──────────────────────────────────────────
export interface CrayonzOptions {
  /** Falls back to the CRAYONZ_API_KEY env var (Node only) when omitted. */
  apiKey?: string;
  /** Defaults to https://api.crayonz.ai */
  baseUrl?: string;
  /** Per-request timeout in ms. Default 60000. */
  timeout?: number;
  /** Retries on 429 and 5xx only, never on other 4xx. Default 2. */
  maxRetries?: number;
  /** Optional cost-allocation tag sent as X-Crayonz-Tag on every request. */
  tag?: string;
  /** Override fetch (e.g. for tests, or a polyfill) — defaults to global fetch. */
  fetch?: typeof fetch;
}

// ─── Design pipeline ────────────────────────────────────────
export interface DesignCustomRequest {
  idea: string;
  style_preferences?: string[];
  color_preferences?: string[];
  target_products?: string[];
  suggested_text?: string;
  auto_mockups?: boolean;
  garment_colors?: string[];
  use_references?: boolean;
  reference_image_base64?: string;
}

export interface DesignReferences {
  used: number;
  queries: string[];
}

/** The completed shape of a design.custom job — what you get from the
 * `?async=0` synchronous call, or from `job.result` once a job completes. */
export interface DesignCustomResult {
  status: string;
  design_id: string;
  file_url: string;
  print_ready: boolean;
  cut_status?: 'done' | 'fallback' | 'pending' | 'failed';
  enhanced_prompt?: string;
  references?: DesignReferences;
}

/** The 202 response POST /api/design/custom returns by default (async). */
export interface JobQueuedResponse {
  status: 'queued';
  job_id: string;
  poll_url: string;
  message?: string;
}

export type JobStatusValue = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface JobStatus {
  id: string;
  job_type: string;
  status: JobStatusValue;
  progress_pct?: number;
  current_step?: string;
  credits_charged?: number;
  result?: DesignCustomResult | Record<string, unknown>;
  error_code?: string;
  last_error?: string;
  completed_at?: string;
}

export interface JobGetResponse {
  status: 'ok';
  job: JobStatus;
}

export interface DesignRow {
  id: string;
  file_url: string;
  width?: number;
  height?: number;
  quality_score?: number;
  print_ready?: boolean;
  cut_status?: string;
  idea?: string;
  source?: string;
  tag?: string | null;
  created_at: string;
}

export interface DesignsListRequest {
  /** Only designs made with this X-Crayonz-Tag. */
  tag?: string;
  /** 1–200, default 50. */
  limit?: number;
}

export interface DesignsListResponse {
  status: string;
  count: number;
  designs: DesignRow[];
}

export interface DesignGetResponse {
  status: string;
  design: DesignRow;
}

// ─── Mockups ────────────────────────────────────────────────
export interface MockupRenderRequest {
  /** Public https URL of a transparent PNG — usually file_url from designs.create. */
  design_url: string;
  /** tshirt, oversized_tshirt, hoodie, zipper_hoodie, polo, acid_wash_tshirt, … */
  garment: string;
  /** Colour name or hex from the garment's palette; defaults to black. */
  color?: string;
  /** front, back, left_sleeve, right_sleeve (per garment). */
  view?: string;
  fill_mode?: 'contain' | 'cover';
}

export interface MockupRenderResult {
  status: string;
  mockup_url: string;
  garment: string;
  color: { name: string; hex: string };
  view: string;
  credits_charged: number;
}

// ─── Quality ────────────────────────────────────────────────
export interface QualityScoreRequest {
  /** Public https URL of the design — usually file_url from designs.create. */
  image_url: string;
  /** What the design was meant to be, in a sentence. */
  design_brief: string;
  check_text?: string;
  brand_colors?: string[];
}

export interface QualityScores {
  composition_balance: number;
  print_readiness: number;
  design_originality: number;
  color_harmony: number;
  brief_adherence: number;
  overall_quality: number;
  text_accuracy?: number;
  brand_color_alignment?: number;
}

export interface QualityScoreResult {
  status: string;
  recommendation: 'approve' | 'review' | 'reject';
  scores: QualityScores;
  issues: string[];
  strengths: string[];
  scored_at: string;
}

// ─── Photoshoot ─────────────────────────────────────────────
export interface PhotoshootSide {
  mockup_url: string;
  design_url: string;
}

export interface PhotoshootModelRequest {
  design_reference_url: string;
  front_side?: PhotoshootSide;
  back_side?: PhotoshootSide;
  garment_type?: string;
  garment_color_hex?: string;
  garment_color_name?: string;
  pattern?: 'front' | 'back';
  vibe?: string;
  /** 1–6 shots. */
  shot_count?: number;
  shot_types?: string[];
  seed?: number;
}

export interface PhotoshootModelShot {
  shot_type: string;
  url: string;
  pose_used?: string;
  cast_used?: string;
  location_used?: string;
  cost_usd?: number;
}

export interface PhotoshootModelResult {
  shots: PhotoshootModelShot[];
  requested: number;
  succeeded: number;
  failure_reason?: string | null;
  model_used: string;
}

export interface PhotoshootProductRequest {
  compositor_flatlay_url: string;
  back_flatlay_url?: string;
  shot_types: string[];
  shot_sides?: string[];
  style_preset?: 'studio_clean' | 'editorial_moody' | 'catalog_flat' | 'lifestyle_warm';
  style_reference_url?: string;
  garment_type?: string;
  garment_color_hex?: string;
  garment_color_name?: string;
  seed?: number;
}

export interface PhotoshootProductShot {
  shot_type: string;
  visible_side: string;
  url: string;
  style_preset: string;
  cost_usd?: number;
}

export interface PhotoshootProductResult {
  shots: PhotoshootProductShot[];
  model_used: string;
}

export interface RecommendVibesRequest {
  title: string;
  description?: string;
  /** 1–5 recommendations. */
  top_k?: number;
  image_url?: string;
}

export interface VibeRecommendation {
  vibe: string;
  confidence: number;
  why: string;
}

export interface RecommendVibesResult {
  recommendations: VibeRecommendation[];
  model_used: string;
}

// ─── Virtual Try-On ─────────────────────────────────────────
export interface TryOnRequest {
  /** URL or base64 of the user photo. */
  userPhoto: string;
  /** URL or base64 of the product image. */
  productImage: string;
  customPrompt?: string;
}

export interface PosePreset {
  id: string;
  pose: string;
}

export interface TryOnVariationsRequest {
  userPhoto: string;
  productImage: string;
  /** 1–4 custom poses. */
  posePresets?: PosePreset[];
}

export type TaskStatusValue = 'queued' | 'processing' | 'completed' | 'failed';

/** The 202 response POST /v1/try-on and /v1/try-on/variations return. */
export interface TaskQueuedResponse {
  taskId: string;
  status: TaskStatusValue;
  message?: string;
}

export interface TaskResultImage {
  id: string;
  pose: string;
  image: string;
}

export interface TaskGetResponse {
  taskId: string;
  status: TaskStatusValue;
  resultImage?: string;
  resultImages?: TaskResultImage[];
  /** Why the task failed, when status is failed. A failed task is not charged. */
  error?: string;
  createdAt?: string;
  completedAt?: string;
}

export interface SizeRecommendationRequest {
  /** Product image URL, or a photo of the shopper when imageType is "person". */
  image: string;
  /** The size chart as plain text (max 10,000 chars). */
  sizeChart: string;
  imageType?: 'product' | 'person';
  availableSizes?: string[];
}

export interface SizeRecommendationResult {
  recommendedSize: string;
  reasoning: string;
  confidence?: number;
}

export interface CompleteOutfitRequest {
  /** 1–10 product image URLs to pair into outfits. */
  productImages: string[];
  userImage?: string;
}

export interface OutfitSuggestion {
  itemIndices: number[];
  description: string;
  category: string;
}

export interface CompleteOutfitResult {
  outfits: OutfitSuggestion[];
  summary: string;
}
