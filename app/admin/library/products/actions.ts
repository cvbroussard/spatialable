'use server';

import sql from '@/lib/db';

export async function getProductSets() {
  const rows = await sql`
    SELECT
      pa.product_ref,
      COUNT(*)::int AS asset_count,
      COUNT(DISTINCT pa.role)::int AS role_count,
      MIN(pa.created_at) AS first_added,
      MAX(pa.updated_at) AS last_updated
    FROM product_assets pa
    GROUP BY pa.product_ref
    ORDER BY MAX(pa.updated_at) DESC
  `;
  return rows;
}

export async function getProductAssets(productRef: string) {
  const rows = await sql`
    SELECT
      pa.*,
      a.thumbnail_url AS asset_thumbnail,
      a.status AS asset_status,
      a.specificity AS asset_specificity,
      a.category_path AS asset_category
    FROM product_assets pa
    LEFT JOIN assets a ON a.id = pa.asset_id
    WHERE pa.product_ref = ${productRef}
    ORDER BY pa.position ASC
  `;
  return rows;
}

export async function updatePosition(id: number, newPosition: number) {
  await sql`UPDATE product_assets SET position = ${newPosition}, updated_at = NOW() WHERE id = ${id}`;
  return { ok: true };
}

export async function removeProductAsset(id: number) {
  await sql`DELETE FROM product_assets WHERE id = ${id}`;
  return { ok: true };
}

export async function reorderProductAssets(productRef: string, orderedIds: number[]) {
  // Reorder all assets for a product by setting positions sequentially
  for (let i = 0; i < orderedIds.length; i++) {
    await sql`
      UPDATE product_assets
      SET position = ${i}, updated_at = NOW()
      WHERE id = ${orderedIds[i]} AND product_ref = ${productRef}
    `;
  }
  return { ok: true };
}
