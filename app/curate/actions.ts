'use server';

import sql, { query } from '@/lib/db';
import { inngest } from '@/lib/inngest/client';
import type { SourceImage, BrandTarget, SourceFunnel, CurationStatus } from '@/lib/types';

// ---------------------------------------------------------------------------
// Source Images
// ---------------------------------------------------------------------------

export interface SourceImageFilters {
  funnel?: SourceFunnel;
  curation_status?: CurationStatus;
  brand_target_id?: number;
  category?: string;
  product_group?: string;
  page?: number;
  per_page?: number;
}

export async function getSourceImages(filters: SourceImageFilters = {}) {
  const page = filters.page ?? 1;
  const perPage = filters.per_page ?? 50;
  const offset = (page - 1) * perPage;

  // Build dynamic WHERE clauses
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (filters.funnel) {
    conditions.push(`funnel = $${paramIdx++}`);
    params.push(filters.funnel);
  }
  if (filters.curation_status) {
    conditions.push(`curation_status = $${paramIdx++}`);
    params.push(filters.curation_status);
  }
  if (filters.brand_target_id) {
    conditions.push(`brand_target_id = $${paramIdx++}`);
    params.push(filters.brand_target_id);
  }
  if (filters.category) {
    conditions.push(`category ILIKE $${paramIdx++}`);
    params.push(`%${filters.category}%`);
  }
  if (filters.product_group) {
    conditions.push(`product_group = $${paramIdx++}`);
    params.push(filters.product_group);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(
    `SELECT COUNT(*)::int as total FROM source_images ${where}`,
    params,
  );

  const rows = await query(
    `SELECT * FROM source_images ${where} ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, perPage, offset],
  );

  return {
    images: rows as SourceImage[],
    total: countResult[0].total as number,
    page,
    per_page: perPage,
  };
}

export async function getSourceImage(id: number): Promise<SourceImage | null> {
  const [row] = await sql`SELECT * FROM source_images WHERE id = ${id}`;
  return (row as SourceImage) || null;
}

export async function updateSourceImage(
  id: number,
  updates: Partial<Pick<
    SourceImage,
    | 'product_name' | 'category' | 'upc' | 'sku' | 'description'
    | 'angle' | 'background_type' | 'material_hints' | 'product_group'
    | 'curation_status' | 'rejection_reason'
  >>,
) {
  const setClauses: string[] = ['updated_at = NOW()'];
  const params: any[] = [];
  let paramIdx = 1;

  const allowedKeys = [
    'product_name', 'category', 'upc', 'sku', 'description',
    'angle', 'background_type', 'material_hints', 'product_group',
    'curation_status', 'rejection_reason',
  ] as const;

  for (const key of allowedKeys) {
    if (key in updates) {
      const value = key === 'material_hints'
        ? JSON.stringify(updates[key])
        : updates[key];
      setClauses.push(`${key} = $${paramIdx++}`);
      params.push(value ?? null);
    }
  }

  params.push(id);
  const result = await query(
    `UPDATE source_images SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    params,
  );

  // Update brand_target denormalized counts if status changed
  if ('curation_status' in updates && result[0]?.brand_target_id) {
    await refreshBrandTargetCounts(result[0].brand_target_id);
  }

  return result[0] as SourceImage;
}

export async function bulkUpdateStatus(
  ids: number[],
  status: CurationStatus,
  rejectionReason?: string,
) {
  if (ids.length === 0) return { updated: 0 };

  const result = await query(
    `UPDATE source_images
     SET curation_status = $1,
         rejection_reason = $2,
         updated_at = NOW()
     WHERE id = ANY($3)
     RETURNING id, brand_target_id`,
    [status, rejectionReason ?? null, ids],
  );

  // Refresh any affected brand target counts
  const brandTargetIds = [...new Set(
    result.filter((r: any) => r.brand_target_id).map((r: any) => r.brand_target_id),
  )];
  for (const btId of brandTargetIds) {
    await refreshBrandTargetCounts(btId as number);
  }

  return { updated: result.length };
}

export async function queueForGeneration(imageIds: number[]) {
  if (imageIds.length === 0) return { job_id: null };

  // Get the images
  const images = await query(
    `SELECT * FROM source_images WHERE id = ANY($1) AND curation_status IN ('candidate', 'pending')`,
    [imageIds],
  );

  if (images.length === 0) throw new Error('No eligible images found');

  // Get the internal client
  const [client] = await sql`
    SELECT id FROM clients WHERE is_active = true ORDER BY created_at LIMIT 1
  `;
  if (!client) throw new Error('No active client found');

  const sourceUrls = images.map((img: any) => img.image_url);
  const firstImage = images[0] as any;

  // Create generation job
  const [job] = await sql`
    INSERT INTO generation_jobs (client_id, source_images, product_metadata)
    VALUES (
      ${client.id},
      ${JSON.stringify(sourceUrls)},
      ${JSON.stringify({
        name: firstImage.product_name,
        upc: firstImage.upc,
        sku: firstImage.sku,
        category: firstImage.category,
      })}
    )
    RETURNING id
  `;

  // Update source images to queued status and link to job
  await query(
    `UPDATE source_images
     SET curation_status = 'queued', generation_job_id = $1, updated_at = NOW()
     WHERE id = ANY($2)`,
    [job.id, imageIds],
  );

  // Fire Inngest event
  await inngest.send({
    name: 'spatialable/generate.requested',
    data: { jobId: job.id, clientId: client.id },
  });

  return { job_id: job.id };
}

// ---------------------------------------------------------------------------
// Brand Targets
// ---------------------------------------------------------------------------

export async function getBrandTargets(): Promise<BrandTarget[]> {
  const rows = await sql`SELECT * FROM brand_targets ORDER BY created_at DESC`;
  return rows as BrandTarget[];
}

export async function createBrandTarget(data: {
  name: string;
  brand_name: string;
  website_url?: string;
  notes?: string;
}): Promise<BrandTarget> {
  const [row] = await sql`
    INSERT INTO brand_targets (name, brand_name, website_url, notes)
    VALUES (${data.name}, ${data.brand_name}, ${data.website_url ?? null}, ${data.notes ?? null})
    RETURNING *
  `;
  return row as BrandTarget;
}

// ---------------------------------------------------------------------------
// Add source image (manual entry)
// ---------------------------------------------------------------------------

export async function addSourceImage(data: {
  image_url: string;
  original_url?: string;
  funnel: SourceFunnel;
  brand_target_id?: number;
  product_name?: string;
  category?: string;
}): Promise<SourceImage> {
  const [row] = await sql`
    INSERT INTO source_images (image_url, original_url, funnel, brand_target_id, product_name, category)
    VALUES (
      ${data.image_url},
      ${data.original_url ?? null},
      ${data.funnel},
      ${data.brand_target_id ?? null},
      ${data.product_name ?? null},
      ${data.category ?? null}
    )
    RETURNING *
  `;

  if (data.brand_target_id) {
    await refreshBrandTargetCounts(data.brand_target_id);
  }

  return row as SourceImage;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function refreshBrandTargetCounts(brandTargetId: number) {
  await sql`
    UPDATE brand_targets SET
      image_count = (SELECT COUNT(*) FROM source_images WHERE brand_target_id = ${brandTargetId}),
      candidate_count = (SELECT COUNT(*) FROM source_images WHERE brand_target_id = ${brandTargetId} AND curation_status = 'candidate'),
      updated_at = NOW()
    WHERE id = ${brandTargetId}
  `;
}
