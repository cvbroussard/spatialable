// ---------------------------------------------------------------------------
// Embed component types (client-side only — runs in consumer's browser)
// ---------------------------------------------------------------------------

export interface SeoPayload {
  thumbnail: string | null;
  alt: string;
  jsonLd: Record<string, any>;
}

export interface AssetRef {
  id: string;
  type: string;
}

export interface ResolveResult {
  html: string;
  seo: SeoPayload | null;
  assets: AssetRef[];
  tier: string;
  expiresIn: number;
}

export type ProductType = 'hero' | 'gallery' | 'configurator';
