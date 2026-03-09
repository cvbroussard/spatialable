'use server';

import sql from '@/lib/db';

export async function getLibraryStats() {
  const [assetStats] = await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
      COUNT(*) FILTER (WHERE status = 'review')::int AS review,
      COUNT(*) FILTER (WHERE status = 'generating')::int AS generating,
      COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected
    FROM assets
  `;

  const [sourceStats] = await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE curation_status = 'pending')::int AS pending,
      COUNT(*) FILTER (WHERE curation_status = 'candidate')::int AS candidate,
      COUNT(*) FILTER (WHERE curation_status = 'queued')::int AS queued,
      COUNT(*) FILTER (WHERE curation_status = 'generating')::int AS generating,
      COUNT(*) FILTER (WHERE curation_status = 'rejected')::int AS rejected
    FROM source_images
  `;

  const [materialCount] = await sql`SELECT COUNT(*)::int AS total FROM materials`;
  const [formFactorCount] = await sql`SELECT COUNT(*)::int AS total FROM form_factors`;

  const [productSetCount] = await sql`
    SELECT COUNT(DISTINCT product_ref)::int AS total FROM product_assets
  `;

  const recentJobs = await sql`
    SELECT id, status, product_metadata, created_at, completed_at
    FROM generation_jobs
    ORDER BY created_at DESC
    LIMIT 10
  `;

  return {
    assets: assetStats,
    sources: sourceStats,
    materials: materialCount.total,
    formFactors: formFactorCount.total,
    productSets: productSetCount.total,
    recentJobs,
  };
}
