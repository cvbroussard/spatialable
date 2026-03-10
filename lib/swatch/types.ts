// ---------------------------------------------------------------------------
// Swatch-to-PBR Pipeline Types
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

export interface ScenarioJobResult {
  id: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
  assets?: ScenarioAsset[];
  error?: string;
}

export interface ScenarioAsset {
  id: string;
  url: string;
  type?: string;
}
