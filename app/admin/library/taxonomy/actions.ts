'use server';

import sql from '@/lib/db';

export async function getFormFactors() {
  const rows = await sql`
    SELECT ff.*,
      (SELECT COUNT(*)::int FROM assets a WHERE a.form_factor_id = ff.id) AS asset_count
    FROM form_factors ff
    ORDER BY ff.category_path, ff.name
  `;
  return rows;
}

export async function getTaxonomyMappings() {
  const rows = await sql`
    SELECT tm.*, ff.name AS form_factor_name
    FROM shopify_taxonomy_map tm
    LEFT JOIN form_factors ff ON ff.id = tm.form_factor_id
    ORDER BY tm.shopify_type
  `;
  return rows;
}

export async function upsertTaxonomyMapping(data: {
  id?: number;
  shopify_type: string;
  category_path: string;
  form_factor_id?: number | null;
}) {
  if (data.id) {
    await sql`
      UPDATE shopify_taxonomy_map
      SET shopify_type = ${data.shopify_type},
          category_path = ${data.category_path},
          form_factor_id = ${data.form_factor_id ?? null}
      WHERE id = ${data.id}
    `;
  } else {
    await sql`
      INSERT INTO shopify_taxonomy_map (shopify_type, category_path, form_factor_id)
      VALUES (${data.shopify_type}, ${data.category_path}, ${data.form_factor_id ?? null})
      ON CONFLICT (shopify_type)
      DO UPDATE SET category_path = EXCLUDED.category_path, form_factor_id = EXCLUDED.form_factor_id
    `;
  }
  return { ok: true };
}

export async function deleteTaxonomyMapping(id: number) {
  await sql`DELETE FROM shopify_taxonomy_map WHERE id = ${id}`;
  return { ok: true };
}
