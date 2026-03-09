'use server';

import sql from '@/lib/db';

export async function getMaterials(filters: {
  material_type?: string;
  source?: string;
  tag?: string;
  page?: number;
  per_page?: number;
}) {
  const { material_type, source, tag, page = 1, per_page = 40 } = filters;

  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (material_type) {
    conditions.push(`m.material_type = $${idx++}`);
    params.push(material_type);
  }
  if (source) {
    conditions.push(`m.source = $${idx++}`);
    params.push(source);
  }
  if (tag) {
    conditions.push(`$${idx++} = ANY(m.tags)`);
    params.push(tag);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * per_page;

  const countResult = await sql(
    `SELECT COUNT(*)::int AS total FROM materials m ${where}`,
    params
  );

  const rows = await sql(
    `SELECT m.* FROM materials m
    ${where}
    ORDER BY m.updated_at DESC
    LIMIT ${per_page} OFFSET ${offset}`,
    params
  );

  return {
    materials: rows,
    total: countResult[0].total,
    page,
    per_page,
  };
}

export async function getMaterial(id: number) {
  const rows = await sql`SELECT * FROM materials WHERE id = ${id}`;
  if (rows.length === 0) return null;

  // Count assets using this material
  const usage = await sql`
    SELECT COUNT(*)::int AS asset_count
    FROM assets a
    WHERE ${id} = ANY(a.matched_material_ids)
  `;

  return { ...rows[0], asset_count: usage[0]?.asset_count || 0 };
}

export async function getFilterOptions() {
  const types = await sql`
    SELECT DISTINCT material_type FROM materials ORDER BY material_type
  `;
  const sources = await sql`
    SELECT DISTINCT source FROM materials ORDER BY source
  `;
  const tags = await sql`
    SELECT DISTINCT unnest(tags) AS tag FROM materials ORDER BY tag
  `;
  return {
    types: types.map((r: any) => r.material_type as string),
    sources: sources.map((r: any) => r.source as string),
    tags: tags.map((r: any) => r.tag as string),
  };
}
