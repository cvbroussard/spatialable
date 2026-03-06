import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAuth } from '@/lib/auth/api-key';

export const dynamic = 'force-dynamic';

/**
 * GET /api/generate/:jobId — Check generation job status.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const guard = await requireAuth(request);
    if (!guard.ok) return guard.response;

    const { jobId } = await params;

    const [job] = await sql`
      SELECT
        j.id, j.status, j.source_images, j.product_metadata,
        j.meshy_task_id, j.identified_materials,
        j.error, j.attempts,
        j.created_at, j.started_at, j.completed_at,
        j.final_asset_id,
        a.glb_url, a.thumbnail_url, a.status AS asset_status
      FROM generation_jobs j
      LEFT JOIN assets a ON a.id = j.final_asset_id
      WHERE j.id = ${jobId} AND j.client_id = ${guard.client.id}
    `;

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const response: any = {
      id: job.id,
      status: job.status,
      attempts: job.attempts,
      created_at: job.created_at,
      started_at: job.started_at,
      completed_at: job.completed_at,
    };

    if (job.error) {
      response.error = job.error;
    }

    if (job.identified_materials) {
      response.identified_materials = job.identified_materials;
    }

    if (job.final_asset_id) {
      response.asset = {
        id: job.final_asset_id,
        glb_url: job.glb_url,
        thumbnail_url: job.thumbnail_url,
        status: job.asset_status,
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[generate/:jobId] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job' },
      { status: 500 },
    );
  }
}
