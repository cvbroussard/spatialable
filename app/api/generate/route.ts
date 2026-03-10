import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAuth } from '@/lib/auth/api-key';
import { inngest } from '@/lib/inngest/client';
import { normalizeGtin } from '@/lib/gtin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/generate — Submit a 3D model generation job.
 *
 * Body: {
 *   source_images: string[],      // URLs to product images (at least 1)
 *   product_metadata?: {           // Optional product context
 *     client_product_id?: string,
 *     upc?: string,
 *     sku?: string,
 *     name?: string,
 *     category?: string,
 *     description?: string,
 *     attributes?: Record<string, any>,
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requireAuth(request);
    if (!guard.ok) return guard.response;

    const body = await request.json();
    const { source_images, product_metadata } = body;

    if (!source_images?.length) {
      return NextResponse.json(
        { error: 'source_images is required and must contain at least one URL' },
        { status: 400 },
      );
    }

    // Validate image URLs
    for (const url of source_images) {
      if (typeof url !== 'string' || !url.startsWith('http')) {
        return NextResponse.json(
          { error: `Invalid image URL: ${url}` },
          { status: 400 },
        );
      }
    }

    // Check for existing asset by GTIN/UPC before generating
    if (product_metadata?.upc) {
      const gtin = normalizeGtin(product_metadata.upc);
      const [existing] = gtin
        ? await sql`
            SELECT id, glb_url, status FROM assets
            WHERE (gtin = ${gtin} OR upc = ${product_metadata.upc}) AND status IN ('approved', 'review')
            LIMIT 1
          `
        : await sql`
            SELECT id, glb_url, status FROM assets
            WHERE upc = ${product_metadata.upc} AND status IN ('approved', 'review')
            LIMIT 1
          `;
      if (existing) {
        return NextResponse.json({
          job_id: null,
          existing_asset: {
            id: existing.id,
            glb_url: existing.glb_url,
            status: existing.status,
          },
          message: 'An asset already exists for this UPC/GTIN',
        });
      }
    }

    // Create job record
    const [job] = await sql`
      INSERT INTO generation_jobs (client_id, source_images, product_metadata)
      VALUES (
        ${guard.client.id},
        ${JSON.stringify(source_images)},
        ${JSON.stringify(product_metadata || {})}
      )
      RETURNING id, status, created_at
    `;

    // Fire Inngest event to start pipeline
    await inngest.send({
      name: 'spatialable/generate.requested',
      data: { jobId: job.id, clientId: guard.client.id },
    });

    return NextResponse.json({
      job_id: job.id,
      status: job.status,
      poll_url: `/api/generate/${job.id}`,
    }, { status: 202 });
  } catch (error) {
    console.error('[generate] Error:', error);
    return NextResponse.json(
      { error: 'Generation request failed' },
      { status: 500 },
    );
  }
}
