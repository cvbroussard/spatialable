'use server';

import sql, { query } from '@/lib/db';
import { inngest } from '@/lib/inngest/client';
import { uploadTexture } from '@/lib/r2/client';
import type { SwatchJob, SwatchJobStatus } from '@/lib/types';

export async function getSwatchJobs(filters: {
  status?: SwatchJobStatus;
  page?: number;
  per_page?: number;
}) {
  const { status, page = 1, per_page = 30 } = filters;

  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (status) {
    conditions.push(`status = $${idx++}`);
    params.push(status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * per_page;

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM swatch_jobs ${where}`,
    params,
  );

  const rows = await query(
    `SELECT * FROM swatch_jobs ${where} ORDER BY created_at DESC LIMIT ${per_page} OFFSET ${offset}`,
    params,
  );

  return {
    jobs: rows as SwatchJob[],
    total: countResult[0].total as number,
    page,
    per_page,
  };
}

export async function getSwatchJob(id: string): Promise<SwatchJob | null> {
  const [row] = await sql`SELECT * FROM swatch_jobs WHERE id = ${id}`;
  return (row as SwatchJob) || null;
}

export async function createSwatchJob(data: {
  imageBase64: string;
  contentType: string;
  manufacturer_name?: string;
  manufacturer_sku?: string;
  material_name?: string;
}): Promise<SwatchJob> {
  // Decode base64 and upload to R2
  const buffer = Buffer.from(data.imageBase64, 'base64');
  const ext = data.contentType.includes('png') ? 'png' : 'jpg';

  // Create the job first to get the ID
  const [job] = await sql`
    INSERT INTO swatch_jobs (
      swatch_image_url,
      manufacturer_name,
      manufacturer_sku,
      material_name
    ) VALUES (
      'pending',
      ${data.manufacturer_name || null},
      ${data.manufacturer_sku || null},
      ${data.material_name || null}
    )
    RETURNING *
  `;

  // Upload swatch image to R2
  const key = `materials/swatch/${job.id}/original.${ext}`;
  const url = await uploadTexture(buffer, key, data.contentType);

  // Update job with the real URL
  await sql`
    UPDATE swatch_jobs SET swatch_image_url = ${url}, updated_at = NOW()
    WHERE id = ${job.id}
  `;

  // Fire Inngest event to start pipeline
  await inngest.send({
    name: 'spatialable/swatch.uploaded',
    data: { jobId: job.id },
  });

  return { ...job, swatch_image_url: url } as SwatchJob;
}

export async function approveSwatchJob(id: string) {
  const [job] = await sql`
    UPDATE swatch_jobs SET status = 'approved', updated_at = NOW()
    WHERE id = ${id} AND status = 'review'
    RETURNING *
  `;
  if (!job) throw new Error('Job not found or not in review status');
  return job as SwatchJob;
}

export async function rejectSwatchJob(id: string) {
  const [job] = await sql`
    UPDATE swatch_jobs SET status = 'rejected', updated_at = NOW()
    WHERE id = ${id} AND status = 'review'
    RETURNING *
  `;
  if (!job) throw new Error('Job not found or not in review status');
  return job as SwatchJob;
}

export async function retrySwatchJob(id: string) {
  const [job] = await sql`
    UPDATE swatch_jobs SET status = 'uploaded', error = NULL, updated_at = NOW()
    WHERE id = ${id} AND status = 'failed'
    RETURNING *
  `;
  if (!job) throw new Error('Job not found or not in failed status');

  await inngest.send({
    name: 'spatialable/swatch.uploaded',
    data: { jobId: id },
  });

  return job as SwatchJob;
}

export async function getSwatchJobStatusCounts() {
  const rows = await sql`
    SELECT status, COUNT(*)::int AS count
    FROM swatch_jobs
    GROUP BY status
    ORDER BY status
  `;
  return rows as { status: string; count: number }[];
}
