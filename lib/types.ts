// ---------------------------------------------------------------------------
// Asset specificity levels
// ---------------------------------------------------------------------------

export type AssetSpecificity = 'upc' | 'sku' | 'form_factor';

export type AssetStatus = 'generating' | 'review' | 'approved' | 'rejected' | 'archived';

export interface Asset {
  id: string;
  specificity: AssetSpecificity;
  status: AssetStatus;
  upc: string | null;
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

export type MaterialSource = 'poly_haven' | 'ambientcg' | 'manufacturer' | 'scanned' | 'custom';

export interface Material {
  id: number;
  name: string;
  material_type: string;
  source: MaterialSource;
  albedo_url: string | null;
  normal_url: string | null;
  roughness_url: string | null;
  metallic_url: string | null;
  ao_url: string | null;
  preview_url: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
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
