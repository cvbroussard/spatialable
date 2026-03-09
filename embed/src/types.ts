// ---------------------------------------------------------------------------
// Embed component types (client-side only — runs in consumer's browser)
// ---------------------------------------------------------------------------

export interface StyleProfile {
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  font_family: string | null;
  font_url: string | null;
  border_radius: string | null;
  background_color: string | null;
  text_color: string | null;
  custom_vars: Record<string, string>;
}

export interface InitResponse {
  valid: boolean;
  tier: string;
  style_profile: StyleProfile | null;
  config: {
    allowed_types: string[];
    impression_remaining: number | null;
  };
  error?: string;
}

export interface ResolvedAsset {
  id: string;
  url: string;
  content_type: string;
  alt: string;
  media_type?: string;
}

export interface ResolveResponse {
  type: string;
  assets: ResolvedAsset[];
  resolved: boolean;
  expires_in: number;
  error?: string;
}

export type ProductType = 'hero' | 'gallery' | 'configurator';
