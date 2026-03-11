/**
 * Shopify Product Fetcher
 *
 * Fetches product data from Shopify stores using the public JSON API.
 * Most Shopify stores expose: /products/{handle}.json
 *
 * Scoped to asset-relevant fields only: title, vendor, product_type,
 * handle, images (src/alt/position), GTIN/UPC/SKU from variants.
 */

import { normalizeGtin } from '@/lib/gtin';
import type { DiscoveredProduct, ProductImage } from './types';

/**
 * Extract the product handle from a URL like:
 *   https://www.brand.com/products/some-product-handle
 *   https://www.brand.com/products/some-product-handle?variant=123
 */
function extractHandle(url: string): string {
  const match = url.match(/\/products\/([^/?#]+)/);
  if (!match) throw new Error(`Cannot extract product handle from URL: ${url}`);
  return match[1];
}

/**
 * Extract the origin (scheme + domain) from a URL.
 */
function extractOrigin(url: string): string {
  const parsed = new URL(url);
  return parsed.origin;
}

/**
 * Fetch a single product from Shopify's public JSON API.
 * Returns only the fields needed for the image pull pipeline.
 */
export async function fetchProduct(url: string, delayMs?: number): Promise<DiscoveredProduct> {
  if (delayMs && delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  const handle = extractHandle(url);
  const origin = extractOrigin(url);
  const apiUrl = `${origin}/products/${handle}.json`;

  const response = await fetch(apiUrl, {
    headers: {
      'User-Agent': 'SpatialAble Asset Importer (compatible; +https://spatialable.com)',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${apiUrl}`);
  }

  const data = await response.json();
  if (!data.product) {
    throw new Error(`Invalid Shopify response from ${apiUrl} (missing "product" key)`);
  }

  return normalizeProduct(data.product);
}

/**
 * Normalize Shopify API response to DiscoveredProduct.
 * Extracts only asset-relevant fields — no pricing, body_html, options, etc.
 */
function normalizeProduct(raw: any): DiscoveredProduct {
  // Images
  const images: ProductImage[] = (raw.images || []).map((img: any, i: number) => ({
    src: img.src || '',
    alt: img.alt || null,
    position: img.position ?? i + 1,
  }));

  // GTIN / UPC / SKU — from first variant with a barcode
  let gtin: string | null = null;
  let upc: string | null = null;
  let sku: string | null = null;

  const variants = raw.variants || [];
  for (const v of variants) {
    if (!sku && v.sku) sku = v.sku;
    if (v.barcode && !gtin && !upc) {
      const normalized = normalizeGtin(v.barcode);
      if (normalized) {
        gtin = normalized;
      } else {
        // Not a valid GTIN — store raw as UPC
        upc = v.barcode;
      }
    }
    if (sku && (gtin || upc)) break;
  }

  return {
    handle: raw.handle || '',
    title: raw.title || '',
    vendor: raw.vendor || null,
    product_type: raw.product_type || null,
    images,
    gtin,
    upc,
    sku,
  };
}
