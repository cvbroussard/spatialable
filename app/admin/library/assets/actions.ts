'use server';

import sql from '@/lib/db';

export async function getAssets(filters: {
  status?: string;
  specificity?: string;
  category?: string;
  page?: number;
  per_page?: number;
}) {
  const { status, specificity, category, page = 1, per_page = 40 } = filters;

  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (status) {
    conditions.push(`a.status = $${idx++}`);
    params.push(status);
  }
  if (specificity) {
    conditions.push(`a.specificity = $${idx++}`);
    params.push(specificity);
  }
  if (category) {
    conditions.push(`a.category_path ILIKE $${idx++}`);
    params.push(`%${category}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * per_page;

  const countResult = await sql(
    `SELECT COUNT(*)::int AS total FROM assets a ${where}`,
    params
  );

  const rows = await sql(
    `SELECT a.*,
      (SELECT COUNT(*)::int FROM product_assets pa WHERE pa.asset_id = a.id) AS product_count
    FROM assets a
    ${where}
    ORDER BY a.updated_at DESC
    LIMIT ${per_page} OFFSET ${offset}`,
    params
  );

  return {
    assets: rows,
    total: countResult[0].total,
    page,
    per_page,
  };
}

export async function getAsset(id: string) {
  const rows = await sql`
    SELECT a.*,
      (SELECT COUNT(*)::int FROM product_assets pa WHERE pa.asset_id = a.id) AS product_count
    FROM assets a
    WHERE a.id = ${id}
  `;
  if (rows.length === 0) return null;

  const productAssets = await sql`
    SELECT pa.product_ref, pa.role, pa.position
    FROM product_assets pa
    WHERE pa.asset_id = ${id}
    ORDER BY pa.product_ref, pa.position
  `;

  return { ...rows[0], product_assets: productAssets };
}

export async function updateAssetStatus(id: string, status: string) {
  const allowed = ['approved', 'review', 'rejected', 'archived'];
  if (!allowed.includes(status)) throw new Error('Invalid status');

  await sql`UPDATE assets SET status = ${status}, updated_at = NOW() WHERE id = ${id}`;
  return { ok: true };
}

export async function getFilterOptions() {
  const categories = await sql`
    SELECT DISTINCT category_path FROM assets
    WHERE category_path IS NOT NULL
    ORDER BY category_path
  `;
  return {
    categories: categories.map((r: any) => r.category_path as string),
  };
}
