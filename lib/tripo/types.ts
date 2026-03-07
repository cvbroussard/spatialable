// ---------------------------------------------------------------------------
// Tripo Image-to-3D API types
// ---------------------------------------------------------------------------

export interface TripoCreateParams {
  image_url: string;
  face_limit?: number;
  texture?: 'no' | 'standard' | 'HD';
  texture_seed?: number;
  auto_size?: boolean;
  quad?: boolean;
  texture_alignment?: 'original_image' | 'geometry';
  orientation?: 'default' | 'align_image';
}

export interface TripoMultiviewParams {
  image_urls: string[];
  face_limit?: number;
  texture?: 'no' | 'standard' | 'HD';
  texture_seed?: number;
  auto_size?: boolean;
  quad?: boolean;
}

export type TripoTaskStatus = 'submitted' | 'processing' | 'success' | 'failed';

export interface TripoUploadResult {
  image_token: string;
}

export interface TripoTaskResult {
  task_id: string;
  type: string;
  status: TripoTaskStatus;
  output?: {
    model?: string;
    pbr_model?: string;
    rendered_image?: string;
  };
  progress: number;
}
