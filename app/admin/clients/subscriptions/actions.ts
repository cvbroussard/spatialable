'use server';

import sql, { query } from '@/lib/db';

export async function getSubscriptions(filters: {
  tier?: string;
  is_active?: string;
  page?: number;
  per_page?: number;
}) {
  const { tier, is_active, page = 1, per_page = 30 } = filters;

  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (tier) {
    conditions.push(`s.tier = $${idx++}`);
    params.push(tier);
  }
  if (is_active === 'true' || is_active === 'false') {
    conditions.push(`s.is_active = $${idx++}`);
    params.push(is_active === 'true');
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * per_page;

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM subscriptions s ${where}`,
    params
  );

  const rows = await query(
    `SELECT s.*, c.name AS client_name
    FROM subscriptions s
    LEFT JOIN clients c ON c.id = s.client_id
    ${where}
    ORDER BY s.created_at DESC
    LIMIT ${per_page} OFFSET ${offset}`,
    params
  );

  return {
    subscriptions: rows,
    total: countResult[0].total,
    page,
    per_page,
  };
}

export async function getSubscription(id: string) {
  const rows = await sql`
    SELECT s.*, c.name AS client_name
    FROM subscriptions s
    LEFT JOIN clients c ON c.id = s.client_id
    WHERE s.id = ${id}
  `;
  if (rows.length === 0) return null;

  const stores = await sql`
    SELECT ss.id, ss.shop_domain, ss.status, ss.product_count, ss.matched_count
    FROM shopify_stores ss
    WHERE ss.subscription_id = ${id}
    ORDER BY ss.shop_domain
  `;

  return { ...rows[0], stores };
}

export async function toggleSubscriptionActive(id: string, is_active: boolean) {
  await sql`
    UPDATE subscriptions SET is_active = ${is_active}, updated_at = NOW() WHERE id = ${id}
  `;
  return { ok: true };
}

export async function updateSubscriptionTier(id: string, tier: string) {
  const allowed = ['base', 'standard', 'premium'];
  if (!allowed.includes(tier)) throw new Error('Invalid tier');

  await sql`
    UPDATE subscriptions SET tier = ${tier}, updated_at = NOW() WHERE id = ${id}
  `;
  return { ok: true };
}

export async function updateDomainWhitelist(id: string, domains: string[]) {
  await sql`
    UPDATE subscriptions SET domain_whitelist = ${domains}, updated_at = NOW() WHERE id = ${id}
  `;
  return { ok: true };
}
