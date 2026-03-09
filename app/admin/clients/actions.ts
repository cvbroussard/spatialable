'use server';

import sql from '@/lib/db';

export async function getClientsWithCounts() {
  const rows = await sql`
    SELECT
      c.id, c.name, c.tier, c.is_active, c.webhook_url, c.created_at,
      (SELECT COUNT(*)::int FROM subscriptions s WHERE s.client_id = c.id) AS subscription_count,
      (SELECT COUNT(*)::int FROM shopify_stores ss WHERE ss.client_id = c.id) AS store_count,
      (SELECT COALESCE(SUM(s2.impressions_used), 0)::int FROM subscriptions s2 WHERE s2.client_id = c.id) AS total_impressions
    FROM clients c
    ORDER BY c.created_at DESC
  `;
  return rows;
}
