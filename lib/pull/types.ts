// ── Pull system types ───────────────────────────────────────────────────

export interface PullConfig {
  sitemaps: string[];
  importer_key: string;
  url_pattern_include: string | null;
  url_pattern_exclude: string | null;
  request_delay_ms: number;
}

export interface BrandTargetWithPull {
  id: number;
  name: string;
  brand_name: string;
  website_url: string | null;
  status: string;
  notes: string | null;
  image_count: number;
  candidate_count: number;
  // Pull config
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
  // Joined from pull_runs
  latest_run_status?: string | null;
  latest_run_id?: string | null;
}

export interface DiscoveredProduct {
  handle: string;
  title: string;
  vendor: string | null;
  product_type: string | null;
  images: ProductImage[];
  gtin: string | null;
  upc: string | null;
  sku: string | null;
}

export interface ProductImage {
  src: string;
  alt: string | null;
  position: number;
}

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

export interface PullRunProgress {
  status: PullRunStatus;
  discovered_urls: number;
  processed_count: number;
  created_count: number;
  skipped_count: number;
  failed_count: number;
  current_url: string | null;
}

export interface PullResult {
  handle: string;
  outcome: 'created' | 'skipped' | 'failed';
  images_created: number;
  error?: string;
}
