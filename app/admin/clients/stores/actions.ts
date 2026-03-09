'use server';

import sql from '@/lib/db';

export async function getStores() {
  const rows = await sql`
    SELECT
      ss.*,
      c.name AS client_name,
      CASE WHEN ss.product_count > 0
        THEN ROUND(ss.matched_count::numeric / ss.product_count * 100, 1)
        ELSE 0
      END AS hit_rate
    FROM shopify_stores ss
    LEFT JOIN clients c ON c.id = ss.client_id
    ORDER BY ss.created_at DESC
  `;
  return rows;
}

export async function getStoreDetail(id: number) {
  const rows = await sql`
    SELECT
      ss.*,
      c.name AS client_name,
      sub.token_prefix AS subscription_token
    FROM shopify_stores ss
    LEFT JOIN clients c ON c.id = ss.client_id
    LEFT JOIN subscriptions sub ON sub.id = ss.subscription_id
    WHERE ss.id = ${id}
  `;
  if (rows.length === 0) return null;

  // Hit rate by match type
  const matchBreakdown = await sql`
    SELECT
      sm.match_type,
      COUNT(*)::int AS count,
      ROUND(AVG(sm.match_confidence), 2) AS avg_confidence,
      SUM(CASE WHEN sm.metafield_written THEN 1 ELSE 0 END)::int AS metafields_written
    FROM shopify_matches sm
    JOIN shopify_products sp ON sp.id = sm.shopify_product_id
    WHERE sp.store_id = ${id}
    GROUP BY sm.match_type
    ORDER BY sm.match_type
  `;

  // Hit rate by product type
  const typeBreakdown = await sql`
    SELECT
      COALESCE(sp.product_type, 'Unknown') AS product_type,
      COUNT(*)::int AS total,
      SUM(CASE WHEN sm.match_type != 'none' THEN 1 ELSE 0 END)::int AS matched,
      ROUND(
        SUM(CASE WHEN sm.match_type != 'none' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1
      ) AS hit_rate
    FROM shopify_products sp
    LEFT JOIN shopify_matches sm ON sm.shopify_product_id = sp.id
    WHERE sp.store_id = ${id}
    GROUP BY sp.product_type
    ORDER BY total DESC
    LIMIT 20
  `;

  // Unmatched products (gap)
  const gapProducts = await sql`
    SELECT sp.title, sp.vendor, sp.product_type, sp.image_url
    FROM shopify_products sp
    LEFT JOIN shopify_matches sm ON sm.shopify_product_id = sp.id
    WHERE sp.store_id = ${id}
      AND (sm.match_type IS NULL OR sm.match_type = 'none')
    ORDER BY sp.title
    LIMIT 20
  `;

  return {
    ...rows[0],
    matchBreakdown,
    typeBreakdown,
    gapProducts,
  };
}

export async function getRecentSyncLog(storeId: number) {
  const rows = await sql`
    SELECT * FROM shopify_sync_log
    WHERE store_id = ${storeId}
    ORDER BY synced_at DESC
    LIMIT 20
  `;
  return rows;
}
