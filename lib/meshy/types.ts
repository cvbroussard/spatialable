// ---------------------------------------------------------------------------
// Meshy Image-to-3D API types
// ---------------------------------------------------------------------------

export interface MeshyCreateParams {
  image_url: string;
  enable_pbr?: boolean;
  topology?: 'quad' | 'triangle';
  target_polycount?: number;
}

export type MeshyTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';

export interface MeshyTaskResult {
  id: string;
  status: MeshyTaskStatus;
  progress: number;
  model_urls?: {
    glb: string;
    fbx: string;
    obj: string;
    usdz: string;
  };
  texture_urls?: Array<{
    base_color: string;
    metallic?: string;
    normal?: string;
    roughness?: string;
  }>;
  thumbnail_url?: string;
  task_error?: {
    message: string;
  };
  created_at: number;
  finished_at?: number;
}
