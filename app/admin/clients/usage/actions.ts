'use server';

import sql from '@/lib/db';

export async function getUsageStats() {
  // Total impressions across all subscriptions
  const totals = await sql`
    SELECT
      SUM(impressions_used)::int AS total_impressions,
      COUNT(*)::int AS total_subscriptions,
      COUNT(*) FILTER (WHERE is_active)::int AS active_subscriptions
    FROM subscriptions
  `;

  // Usage by client
  const byClient = await sql`
    SELECT
      c.id,
      c.name,
      c.tier,
      COUNT(s.id)::int AS subscription_count,
      COALESCE(SUM(s.impressions_used), 0)::int AS total_impressions,
      COALESCE(SUM(s.impression_limit), 0)::int AS total_limit
    FROM clients c
    LEFT JOIN subscriptions s ON s.client_id = c.id
    GROUP BY c.id, c.name, c.tier
    ORDER BY total_impressions DESC
  `;

  // Top assets by access_count (from embed impressions table if exists, else product_assets usage)
  // For now use product_assets as a proxy: assets assigned to the most products
  const topAssets = await sql`
    SELECT
      a.id,
      a.thumbnail_url,
      a.category_path,
      a.specificity,
      a.upc,
      a.gtin,
      a.manufacturer_sku,
      COUNT(pa.id)::int AS assignment_count
    FROM assets a
    JOIN product_assets pa ON pa.asset_id = a.id
    GROUP BY a.id, a.thumbnail_url, a.category_path, a.specificity, a.upc, a.gtin, a.manufacturer_sku
    ORDER BY assignment_count DESC
    LIMIT 20
  `;

  // Impressions by tier
  const byTier = await sql`
    SELECT
      tier,
      COUNT(*)::int AS subscription_count,
      COALESCE(SUM(impressions_used), 0)::int AS total_impressions
    FROM subscriptions
    GROUP BY tier
    ORDER BY tier
  `;

  return {
    totalImpressions: totals[0]?.total_impressions || 0,
    totalSubscriptions: totals[0]?.total_subscriptions || 0,
    activeSubscriptions: totals[0]?.active_subscriptions || 0,
    byClient,
    topAssets,
    byTier,
  };
}
