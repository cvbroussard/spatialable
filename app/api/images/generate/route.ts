import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAuth } from '@/lib/auth/api-key';
import { inngest } from '@/lib/inngest/client';
import { parseGtin } from '@/lib/gtin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/images/generate — Submit an image generation job.
 *
 * Body: {
 *   gtin: string,                  // GTIN (8/12/13/14 digits)
 *   product_description: string,   // Base product description for prompts
 *   reference_images?: string[],   // Optional reference image URLs
 *   series?: 'studio_angles',      // Series type (default: studio_angles)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requireAuth(request);
    if (!guard.ok) return guard.response;

    const body = await request.json();
    const { gtin: rawGtin, product_description, reference_images, series } = body;

    // Validate required fields
    if (!rawGtin) {
      return NextResponse.json({ error: 'gtin is required' }, { status: 400 });
    }
    if (!product_description || typeof product_description !== 'string') {
      return NextResponse.json({ error: 'product_description is required' }, { status: 400 });
    }

    // Validate and normalize GTIN
    const gtinResult = parseGtin(rawGtin);
    if (!gtinResult.valid || !gtinResult.normalized) {
      return NextResponse.json(
        { error: `Invalid GTIN: ${gtinResult.error}` },
        { status: 400 },
      );
    }
    const gtin = gtinResult.normalized;

    // Validate reference image URLs if provided
    if (reference_images) {
      if (!Array.isArray(reference_images)) {
        return NextResponse.json({ error: 'reference_images must be an array' }, { status: 400 });
      }
      for (const url of reference_images) {
        if (typeof url !== 'string' || !url.startsWith('http')) {
          return NextResponse.json({ error: `Invalid reference image URL: ${url}` }, { status: 400 });
        }
      }
    }

    // Check for in-progress job for this GTIN (409 Conflict)
    const [existing] = await sql`
      SELECT id, status FROM image_gen_jobs
      WHERE gtin = ${gtin} AND status IN ('queued', 'generating', 'uploading')
      LIMIT 1
    `;
    if (existing) {
      return NextResponse.json(
        {
          error: 'A generation job is already in progress for this GTIN',
          existing_job: { id: existing.id, status: existing.status },
        },
        { status: 409 },
      );
    }

    // Create job record
    const [job] = await sql`
      INSERT INTO image_gen_jobs (
        gtin, client_id, source_prompt, source_refs, series
      ) VALUES (
        ${gtin},
        ${guard.client.id},
        ${product_description},
        ${reference_images || []},
        ${series || 'studio_angles'}::image_gen_series
      )
      RETURNING id, status, created_at
    `;

    // Fire Inngest event
    await inngest.send({
      name: 'spatialable/images.generate-requested',
      data: { jobId: job.id },
    });

    return NextResponse.json({
      job_id: job.id,
      status: job.status,
      gtin,
      poll_url: `/api/images/generate/${job.id}`,
    }, { status: 202 });
  } catch (error) {
    console.error('[images/generate] Error:', error);
    return NextResponse.json(
      { error: 'Image generation request failed' },
      { status: 500 },
    );
  }
}
