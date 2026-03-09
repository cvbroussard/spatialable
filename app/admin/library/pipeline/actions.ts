'use server';

import sql, { query } from '@/lib/db';

export async function getJobs(filters: {
  status?: string;
  page?: number;
  per_page?: number;
}) {
  const { status, page = 1, per_page = 30 } = filters;

  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (status) {
    conditions.push(`j.status = $${idx++}`);
    params.push(status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * per_page;

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM generation_jobs j ${where}`,
    params
  );

  const rows = await query(
    `SELECT j.*,
      c.name AS client_name,
      jsonb_array_length(j.source_images) AS source_count
    FROM generation_jobs j
    LEFT JOIN clients c ON c.id = j.client_id
    ${where}
    ORDER BY j.created_at DESC
    LIMIT ${per_page} OFFSET ${offset}`,
    params
  );

  return {
    jobs: rows,
    total: countResult[0].total,
    page,
    per_page,
  };
}

export async function getJob(id: string) {
  const rows = await sql`
    SELECT j.*,
      c.name AS client_name,
      jsonb_array_length(j.source_images) AS source_count
    FROM generation_jobs j
    LEFT JOIN clients c ON c.id = j.client_id
    WHERE j.id = ${id}
  `;
  if (rows.length === 0) return null;

  // Get linked source images
  const sourceImages = await sql`
    SELECT si.id, si.image_url, si.product_name, si.curation_status
    FROM source_images si
    WHERE si.generation_job_id = ${id}
    ORDER BY si.id
  `;

  return { ...rows[0], linked_source_images: sourceImages };
}

export async function retryJob(id: string) {
  const rows = await sql`
    SELECT status FROM generation_jobs WHERE id = ${id}
  `;
  if (rows.length === 0) throw new Error('Job not found');
  if (rows[0].status !== 'failed') throw new Error('Only failed jobs can be retried');

  await sql`
    UPDATE generation_jobs
    SET status = 'queued', error = NULL, attempts = attempts + 1, updated_at = NOW()
    WHERE id = ${id}
  `;
  return { ok: true };
}

export async function getPipelineStats() {
  const rows = await sql`
    SELECT
      status,
      COUNT(*)::int AS count
    FROM generation_jobs
    GROUP BY status
    ORDER BY status
  `;
  return rows;
}
