import sql from '@/lib/db';
import type { HitRateReport } from './types';

// ---------------------------------------------------------------------------
// Hit rate report generator
//
// The sales tool. Shows what percentage of a client's Shopify catalog
// SpatialAble can serve today, broken down by match tier and product type.
// ---------------------------------------------------------------------------

/**
 * Generate a hit rate report for a connected Shopify store.
 */
export async function generateHitRateReport(storeId: number): Promise<HitRateReport> {
  // Store info
  const [store] = await sql`
    SELECT shop_domain, product_count FROM shopify_stores WHERE id = ${storeId}
  `;
  if (!store) throw new Error(`Store ${storeId} not found`);

  // Match distribution by tier
  const tierCounts = await sql`
    SELECT m.match_type, COUNT(*)::int AS count
    FROM shopify_matches m
    JOIN shopify_products p ON p.id = m.shopify_product_id
    WHERE p.store_id = ${storeId}
    GROUP BY m.match_type
  `;

  const totalProducts = await sql`
    SELECT COUNT(*)::int AS count FROM shopify_products WHERE store_id = ${storeId}
  `;
  const total = totalProducts[0]?.count || 0;

  const byTier: Record<string, { count: number; pct: number }> = {};
  let matched = 0;
  for (const row of tierCounts) {
    const count = row.count;
    byTier[row.match_type] = {
      count,
      pct: total > 0 ? Number((count / total).toFixed(3)) : 0,
    };
    if (row.match_type !== 'none') {
      matched += count;
    }
  }

  // Fill missing tiers with zeros
  for (const tier of ['upc', 'sku', 'vendor_type', 'form_factor', 'none']) {
    if (!byTier[tier]) {
      byTier[tier] = { count: 0, pct: 0 };
    }
  }

  // By product_type breakdown
  const typeBreakdown = await sql`
    SELECT
      p.product_type AS type,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE m.match_type != 'none')::int AS matched
    FROM shopify_products p
    LEFT JOIN shopify_matches m ON m.shopify_product_id = p.id
    WHERE p.store_id = ${storeId} AND p.product_type IS NOT NULL
    GROUP BY p.product_type
    ORDER BY total DESC
  `;

  const byProductType = typeBreakdown.map((row: any) => ({
    type: row.type,
    total: row.total,
    matched: row.matched,
    hit_rate: row.total > 0 ? Number((row.matched / row.total).toFixed(3)) : 0,
  }));

  // Gap products — unmatched with images (for speculative generation)
  const gapProducts = await sql`
    SELECT p.title, p.vendor, p.product_type AS type, p.upc, p.sku, p.image_url
    FROM shopify_products p
    JOIN shopify_matches m ON m.shopify_product_id = p.id
    WHERE p.store_id = ${storeId}
      AND m.match_type = 'none'
      AND p.image_url IS NOT NULL
    ORDER BY p.title
    LIMIT 500
  `;

  return {
    store: store.shop_domain,
    total_products: total,
    matched,
    unmatched: total - matched,
    hit_rate: total > 0 ? Number((matched / total).toFixed(3)) : 0,
    by_tier: byTier,
    by_product_type: byProductType,
    gap_products: gapProducts.map((p: any) => ({
      title: p.title,
      vendor: p.vendor,
      type: p.type,
      upc: p.upc,
      sku: p.sku,
      image_url: p.image_url,
    })),
  };
}
