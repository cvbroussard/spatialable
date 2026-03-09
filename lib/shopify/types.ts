// ---------------------------------------------------------------------------
// Shopify Admin API response shapes (minimal — only fields we read)
// ---------------------------------------------------------------------------

export interface ShopifyVariantResponse {
  id: number;
  title: string;
  sku: string | null;
  barcode: string | null;
  price: string;
  inventory_quantity: number;
}

export interface ShopifyImageResponse {
  id: number;
  src: string;
  alt: string | null;
  position: number;
}

export interface ShopifyProductResponse {
  id: number;
  title: string;
  vendor: string | null;
  product_type: string | null;
  handle: string;
  status: string; // active | draft | archived
  variants: ShopifyVariantResponse[];
  images: ShopifyImageResponse[];
  created_at: string;
  updated_at: string;
}

export interface ShopifyMetafieldResponse {
  id: number;
  namespace: string;
  key: string;
  value: string;
  type: string;
}

// ---------------------------------------------------------------------------
// Internal matching types
// ---------------------------------------------------------------------------

export interface MatchResult {
  shopifyProductId: number; // shopify_products.id (internal)
  assetId: string | null;
  matchType: 'upc' | 'sku' | 'vendor_type' | 'form_factor' | 'none';
  matchConfidence: number;
}

export interface HitRateReport {
  store: string;
  total_products: number;
  matched: number;
  unmatched: number;
  hit_rate: number;
  by_tier: Record<string, { count: number; pct: number }>;
  by_product_type: Array<{
    type: string;
    total: number;
    matched: number;
    hit_rate: number;
  }>;
  gap_products: Array<{
    title: string;
    vendor: string | null;
    type: string | null;
    upc: string | null;
    sku: string | null;
    image_url: string | null;
  }>;
}
