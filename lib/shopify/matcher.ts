import sql from '@/lib/db';
import type { MatchResult } from './types';

// ---------------------------------------------------------------------------
// 5-tier batch matching cascade
//
// Matches Shopify products against the SpatialAble assets table.
// Cascade: UPC (1.0) → SKU (1.0) → vendor+type (0.8) → form_factor (0.7) → none (0.0)
// First hit wins — remaining tiers skipped for that product.
//
// Batch-optimized: collects all UPCs/SKUs into bulk queries (WHERE x = ANY($1))
// rather than N individual queries.
// ---------------------------------------------------------------------------

interface ProductToMatch {
  id: number; // shopify_products.id
  upc: string | null;
  sku: string | null;
  vendor: string | null;
  product_type: string | null;
}

/**
 * Match a batch of Shopify products against SpatialAble assets.
 * Returns one MatchResult per product.
 */
export async function matchProducts(products: ProductToMatch[]): Promise<MatchResult[]> {
  const results: Map<number, MatchResult> = new Map();
  let unmatched = [...products];

  // ── Tier 1: GTIN match (bulk, normalized) ─────────────────────────────

  const withGtin = unmatched.filter((p) => (p as any).gtin);
  if (withGtin.length > 0) {
    const gtins = withGtin.map((p) => (p as any).gtin as string);
    const assets = await sql`
      SELECT id, gtin FROM assets
      WHERE gtin = ANY(${gtins}) AND status = 'approved'
    `;

    const gtinToAsset = new Map(assets.map((a: any) => [a.gtin, a.id]));

    for (const product of withGtin) {
      const assetId = gtinToAsset.get((product as any).gtin);
      if (assetId) {
        results.set(product.id, {
          shopifyProductId: product.id,
          assetId,
          matchType: 'gtin',
          matchConfidence: 1.0,
        });
      }
    }

    unmatched = unmatched.filter((p) => !results.has(p.id));
  }

  // ── Tier 1b: UPC match (bulk, raw barcode fallback) ─────────────────

  const withUpc = unmatched.filter((p) => p.upc);
  if (withUpc.length > 0) {
    const upcs = withUpc.map((p) => p.upc!);
    const assets = await sql`
      SELECT id, upc FROM assets
      WHERE upc = ANY(${upcs}) AND status = 'approved'
    `;

    const upcToAsset = new Map(assets.map((a: any) => [a.upc, a.id]));

    for (const product of withUpc) {
      const assetId = upcToAsset.get(product.upc!);
      if (assetId) {
        results.set(product.id, {
          shopifyProductId: product.id,
          assetId,
          matchType: 'upc',
          matchConfidence: 1.0,
        });
      }
    }

    unmatched = unmatched.filter((p) => !results.has(p.id));
  }

  // ── Tier 2: SKU match (bulk) ───────────────────────────────────────────

  const withSku = unmatched.filter((p) => p.sku);
  if (withSku.length > 0) {
    const skus = withSku.map((p) => p.sku!);
    const assets = await sql`
      SELECT id, manufacturer_sku FROM assets
      WHERE manufacturer_sku = ANY(${skus}) AND status = 'approved'
    `;

    const skuToAsset = new Map(assets.map((a: any) => [a.manufacturer_sku, a.id]));

    for (const product of withSku) {
      const assetId = skuToAsset.get(product.sku!);
      if (assetId) {
        results.set(product.id, {
          shopifyProductId: product.id,
          assetId,
          matchType: 'sku',
          matchConfidence: 1.0,
        });
      }
    }

    unmatched = unmatched.filter((p) => !results.has(p.id));
  }

  // ── Tier 3: Vendor + product_type match ────────────────────────────────

  const withVendorType = unmatched.filter((p) => p.vendor && p.product_type);
  if (withVendorType.length > 0) {
    // Look up category_path for each product_type via taxonomy map
    const productTypes = [...new Set(withVendorType.map((p) => p.product_type!))];
    const taxonomyRows = await sql`
      SELECT shopify_type, category_path FROM shopify_taxonomy_map
      WHERE shopify_type = ANY(${productTypes})
    `;
    const typeToCategory = new Map(taxonomyRows.map((r: any) => [r.shopify_type, r.category_path]));

    for (const product of withVendorType) {
      if (results.has(product.id)) continue;

      const categoryPath = typeToCategory.get(product.product_type!);
      if (!categoryPath) continue;

      const [asset] = await sql`
        SELECT id FROM assets
        WHERE attributes->>'vendor' = ${product.vendor!}
          AND category_path = ${categoryPath}
          AND status = 'approved'
        LIMIT 1
      `;

      if (asset) {
        results.set(product.id, {
          shopifyProductId: product.id,
          assetId: asset.id,
          matchType: 'vendor_type',
          matchConfidence: 0.8,
        });
      }
    }

    unmatched = unmatched.filter((p) => !results.has(p.id));
  }

  // ── Tier 4: Form factor match ──────────────────────────────────────────

  const withType = unmatched.filter((p) => p.product_type);
  if (withType.length > 0) {
    const productTypes = [...new Set(withType.map((p) => p.product_type!))];
    const taxonomyRows = await sql`
      SELECT shopify_type, form_factor_id FROM shopify_taxonomy_map
      WHERE shopify_type = ANY(${productTypes}) AND form_factor_id IS NOT NULL
    `;
    const typeToFormFactor = new Map(taxonomyRows.map((r: any) => [r.shopify_type, r.form_factor_id]));

    for (const product of withType) {
      if (results.has(product.id)) continue;

      const formFactorId = typeToFormFactor.get(product.product_type!);
      if (!formFactorId) continue;

      const [asset] = await sql`
        SELECT id FROM assets
        WHERE form_factor_id = ${formFactorId}
          AND specificity = 'form_factor'
          AND status = 'approved'
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (asset) {
        results.set(product.id, {
          shopifyProductId: product.id,
          assetId: asset.id,
          matchType: 'form_factor',
          matchConfidence: 0.7,
        });
      }
    }

    unmatched = unmatched.filter((p) => !results.has(p.id));
  }

  // ── Tier 5: No match ──────────────────────────────────────────────────

  for (const product of unmatched) {
    results.set(product.id, {
      shopifyProductId: product.id,
      assetId: null,
      matchType: 'none',
      matchConfidence: 0.0,
    });
  }

  // Return in original order
  return products.map((p) => results.get(p.id)!);
}
