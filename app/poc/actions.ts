'use server';

import sql from '@/lib/db';
import { inngest } from '@/lib/inngest/client';
import { normalizeGtin } from '@/lib/gtin';

export async function submitGeneration(
  sourceImages: string[],
  metadata: { name?: string; upc?: string; sku?: string; category?: string },
) {
  // Check for existing asset by GTIN/UPC
  if (metadata.upc) {
    const gtin = normalizeGtin(metadata.upc);
    const [existing] = gtin
      ? await sql`
          SELECT id, glb_url, status FROM assets
          WHERE (gtin = ${gtin} OR upc = ${metadata.upc}) AND status IN ('approved', 'review')
          LIMIT 1
        `
      : await sql`
          SELECT id, glb_url, status FROM assets
          WHERE upc = ${metadata.upc} AND status IN ('approved', 'review')
          LIMIT 1
        `;
    if (existing) {
      return {
        job_id: null,
        existing_asset: { id: existing.id, glb_url: existing.glb_url, status: existing.status },
        message: 'An asset already exists for this UPC/GTIN',
      };
    }
  }

  // Get the internal client (first active client)
  const [client] = await sql`
    SELECT id FROM clients WHERE is_active = true ORDER BY created_at LIMIT 1
  `;
  if (!client) throw new Error('No active client found');

  // Create job
  const [job] = await sql`
    INSERT INTO generation_jobs (client_id, source_images, product_metadata)
    VALUES (
      ${client.id},
      ${JSON.stringify(sourceImages)},
      ${JSON.stringify(metadata)}
    )
    RETURNING id, status, created_at
  `;

  // Fire Inngest event
  await inngest.send({
    name: 'spatialable/generate.requested',
    data: { jobId: job.id, clientId: client.id },
  });

  return { job_id: job.id, status: job.status };
}

export async function pollJobStatus(jobId: string) {
  const [job] = await sql`
    SELECT
      id, status, attempts, error,
      created_at, started_at, completed_at,
      identified_materials, final_asset_id
    FROM generation_jobs
    WHERE id = ${jobId}
  `;

  if (!job) return null;

  let asset = null;
  if (job.final_asset_id) {
    const [a] = await sql`
      SELECT id, glb_url, thumbnail_url, status, vertex_count,
             file_size_bytes, source_images, category_path
      FROM assets WHERE id = ${job.final_asset_id}
    `;
    asset = a || null;
  }

  return {
    id: job.id,
    status: job.status,
    attempts: job.attempts,
    error: job.error,
    created_at: job.created_at,
    started_at: job.started_at,
    completed_at: job.completed_at,
    identified_materials: job.identified_materials,
    asset,
  };
}
