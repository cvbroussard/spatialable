// ---------------------------------------------------------------------------
// Asset specificity levels
// ---------------------------------------------------------------------------

export type AssetSpecificity = 'upc' | 'sku' | 'form_factor' | 'gtin';

export type AssetStatus = 'generating' | 'review' | 'approved' | 'rejected' | 'archived';

export interface Asset {
  id: string;
  specificity: AssetSpecificity;
  status: AssetStatus;
  upc: string | null;
  gtin: string | null;
  manufacturer_sku: string | null;
  form_factor_id: number | null;
  glb_url: string | null;
  thumbnail_url: string | null;
  vertex_count: number | null;
  file_size_bytes: number | null;
  source_images: string[];
  category_path: string | null;
  attributes: Record<string, any>;
  tags: string[];
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Materials (PBR library)
// ---------------------------------------------------------------------------

export type MaterialSource = 'poly_haven' | 'ambientcg' | 'manufacturer' | 'scanned' | 'custom' | 'swatch';

export interface Material {
  id: number;
  name: string;
  material_type: string;
  source: MaterialSource;
  external_id: string | null;
  albedo_url: string | null;
  normal_url: string | null;
  roughness_url: string | null;
  metallic_url: string | null;
  ao_url: string | null;
  height_url: string | null;
  preview_url: string | null;
  manufacturer_name: string | null;
  manufacturer_sku: string | null;
  color_hex: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Swatch jobs (swatch-to-PBR pipeline)
// ---------------------------------------------------------------------------

export type SwatchJobStatus =
  | 'uploaded'
  | 'analyzing'
  | 'preprocessing'
  | 'deriving'
  | 'review'
  | 'approved'
  | 'rejected'
  | 'failed';

export interface SwatchJob {
  id: string;
  swatch_image_url: string;
  manufacturer_name: string | null;
  manufacturer_sku: string | null;
  material_name: string | null;
  status: SwatchJobStatus;
  vision_analysis: SwatchVisionAnalysis | null;
  derived_material_type: string | null;
  derived_tags: string[];
  preprocessed_albedo_url: string | null;
  scenario_job_id: string | null;
  material_id: number | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface SwatchVisionAnalysis {
  material_category: string;
  material_subcategory: string;
  weave_pattern: string;
  color_primary: string;
  color_description: string;
  finish: string;
  texture_scale: 'fine' | 'medium' | 'coarse';
  surface_regularity: 'uniform' | 'slightly_irregular' | 'heavily_textured';
  estimated_roughness: number;
  estimated_metallic: number;
  tiling_recommendation: string;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Form factors (shape taxonomy)
// ---------------------------------------------------------------------------

export interface FormFactor {
  id: number;
  parent_id: number | null;
  category_path: string;
  name: string;
  structural_attributes: Record<string, any>;
  base_mesh_url: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Generation jobs (pipeline state machine)
// ---------------------------------------------------------------------------

export type JobStatus =
  | 'queued'
  | 'meshy_submitted'
  | 'mesh_ready'
  | 'material_matching'
  | 'materials_matched'
  | 'blender_processing'
  | 'post_processing'
  | 'review'
  | 'complete'
  | 'failed';

export interface GenerationJob {
  id: string;
  client_id: string;
  status: JobStatus;
  source_images: string[];
  product_metadata: Record<string, any>;
  meshy_task_id: string | null;
  raw_mesh_url: string | null;
  identified_materials: IdentifiedMaterial[] | null;
  matched_material_ids: number[] | null;
  final_asset_id: string | null;
  error: string | null;
  attempts: number;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

// ---------------------------------------------------------------------------
// Material identification (Claude Vision output)
// ---------------------------------------------------------------------------

export interface IdentifiedMaterial {
  region: string;
  material_type: string;
  color: string;
  finish: string;
  confidence: number;
}

export interface MaterialIdentificationResult {
  materials: IdentifiedMaterial[];
  dominant_material: string;
  product_category: string;
}

// ---------------------------------------------------------------------------
// Clients (API consumers)
// ---------------------------------------------------------------------------

export type ClientTier = 'internal' | 'partner' | 'commercial';

export interface Client {
  id: string;
  name: string;
  api_key_hash: string;
  tier: ClientTier;
  webhook_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthenticatedClient {
  id: string;
  name: string;
  tier: ClientTier;
}

// ---------------------------------------------------------------------------
// Source image curation
// ---------------------------------------------------------------------------

export type SourceFunnel = 'brand_pull' | 'library' | 'web_search' | 'ai_generated' | 'partner';

export type CurationStatus = 'pending' | 'candidate' | 'queued' | 'generating' | 'rejected';

export type SurveyStatus = 'targeting' | 'surveying' | 'pulling' | 'curating' | 'complete';

export interface SourceImage {
  id: number;
  image_url: string;
  original_url: string | null;
  thumbnail_url: string | null;
  funnel: SourceFunnel;
  curation_status: CurationStatus;
  brand_target_id: number | null;
  product_name: string | null;
  category: string | null;
  upc: string | null;
  gtin: string | null;
  sku: string | null;
  description: string | null;
  width: number | null;
  height: number | null;
  file_size_bytes: number | null;
  content_type: string | null;
  quality_score: number | null;
  background_type: string | null;
  angle: string | null;
  material_hints: any[];
  rejection_reason: string | null;
  product_group: string | null;
  generation_job_id: string | null;
  source_url: string | null;
  vendor: string | null;
  product_handle: string | null;
  image_position: number | null;
  created_at: string;
  updated_at: string;
}

export interface BrandTarget {
  id: number;
  name: string;
  brand_name: string;
  website_url: string | null;
  status: SurveyStatus;
  notes: string | null;
  image_count: number;
  candidate_count: number;
  sitemaps: string[];
  importer_key: string;
  url_pattern_include: string | null;
  url_pattern_exclude: string | null;
  request_delay_ms: number;
  last_pull_at: string | null;
  discovered_count: number;
  pulled_count: number;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Pull runs (image pull pipeline tracking)
// ---------------------------------------------------------------------------

export type PullRunStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface PullRun {
  id: string;
  brand_target_id: number;
  status: PullRunStatus;
  discovered_urls: number;
  processed_count: number;
  created_count: number;
  skipped_count: number;
  failed_count: number;
  current_url: string | null;
  errors: { url: string; error: string }[];
  started_at: string;
  completed_at: string | null;
}

// ---------------------------------------------------------------------------
// Product asset ordering
// ---------------------------------------------------------------------------

export type AssetRole = 'hero' | 'gallery' | 'detail' | 'lifestyle' | 'video' | 'model';

export interface ProductAsset {
  id: number;
  product_ref: string;
  asset_id: string;
  role: AssetRole;
  position: number;
  content_type: string;
  url: string;
  alt: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Shopify integration
// ---------------------------------------------------------------------------

export type ShopifyStoreStatus = 'pending' | 'active' | 'paused' | 'disconnected';

export type ShopifyMatchType = 'upc' | 'sku' | 'vendor_type' | 'form_factor' | 'gtin' | 'none';

export interface ShopifyStore {
  id: number;
  client_id: string;
  subscription_id: string | null;
  shop_domain: string;
  access_token_encrypted: string;
  access_token_iv: string;
  scopes: string[];
  status: ShopifyStoreStatus;
  webhook_secret: string | null;
  last_sync_at: string | null;
  product_count: number;
  matched_count: number;
  created_at: string;
  updated_at: string;
}

export interface ShopifyProduct {
  id: number;
  store_id: number;
  shopify_product_id: number;
  shopify_variant_id: number | null;
  title: string;
  vendor: string | null;
  product_type: string | null;
  handle: string | null;
  upc: string | null;
  gtin: string | null;
  sku: string | null;
  image_url: string | null;
  status: string;
  synced_at: string;
}

export interface ShopifyMatch {
  id: number;
  shopify_product_id: number;
  asset_id: string | null;
  match_type: ShopifyMatchType;
  match_confidence: number;
  metafield_written: boolean;
  metafield_written_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShopifyTaxonomyMap {
  id: number;
  shopify_type: string;
  category_path: string;
  form_factor_id: number | null;
  created_at: string;
}

export interface ShopifySyncLog {
  id: number;
  store_id: number;
  event_type: string;
  shopify_product_id: number | null;
  details: Record<string, any>;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Subscriptions (embed delivery)
// ---------------------------------------------------------------------------

export type SubscriptionTier = 'base' | 'standard' | 'premium';

export interface Subscription {
  id: string;
  client_id: string;
  token_prefix: string;
  token_hash: string;
  tier: SubscriptionTier;
  domain_whitelist: string[];
  style_profile_id: number | null;
  is_active: boolean;
  impression_limit: number | null;
  impressions_used: number;
  billing_period_start: string;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

// ---------------------------------------------------------------------------
// Style profiles (embed branding)
// ---------------------------------------------------------------------------

export interface StyleProfile {
  id: number;
  name: string;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  font_family: string | null;
  font_url: string | null;
  border_radius: string | null;
  background_color: string | null;
  text_color: string | null;
  custom_vars: Record<string, string>;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Product ref mapping (per-client product identifier resolution)
// ---------------------------------------------------------------------------

export interface ProductRefMap {
  id: number;
  client_id: string;
  external_ref: string;
  canonical_ref: string;
  match_type: 'upc' | 'sku' | 'shopify' | 'manual' | 'gtin';
  created_at: string;
}

// ---------------------------------------------------------------------------
// Taxonomy assets (category, brand, editorial)
// ---------------------------------------------------------------------------

export type TaxonomyAssetStatus = 'generating' | 'review' | 'approved';

export interface CategoryAsset {
  id: number;
  form_factor_id: number;
  role: 'card' | 'hero' | 'icon' | 'placeholder';
  url: string;
  content_type: string | null;
  width: number | null;
  height: number | null;
  status: TaxonomyAssetStatus;
  created_at: string;
  updated_at: string;
}

export interface BrandTaxonomy {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  product_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BrandAsset {
  id: number;
  brand_id: number;
  role: 'logo' | 'hero' | 'card';
  url: string;
  content_type: string | null;
  width: number | null;
  height: number | null;
  status: TaxonomyAssetStatus;
  created_at: string;
  updated_at: string;
}

export interface EditorialAsset {
  id: number;
  name: string;
  page_scope: 'home' | 'collection' | 'global';
  role: 'hero' | 'banner' | 'lifestyle';
  url: string;
  content_type: string | null;
  width: number | null;
  height: number | null;
  position: number;
  active_from: string | null;
  active_until: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Image generation (AI product photography)
// ---------------------------------------------------------------------------

export type ImageGenStatus = 'queued' | 'generating' | 'uploading' | 'complete' | 'failed';

export type ImageGenSeries = 'studio_angles';

export interface ImageGenResult {
  angle: string;
  url: string;
  thumbnailUrl: string;
  sourceImageId: number;
  productAssetId: number;
}

export interface ImageGenJob {
  id: string;
  gtin: string;
  client_id: string;
  status: ImageGenStatus;
  series: ImageGenSeries;
  model_used: string | null;
  source_prompt: string;
  source_refs: string[];
  total_images: number;
  completed_images: number;
  results: ImageGenResult[];
  error: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}
