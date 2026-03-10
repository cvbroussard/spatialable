import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAuth } from '@/lib/auth/api-key';

export const dynamic = 'force-dynamic';

/**
 * GET /api/images/generate/:jobId — Check image generation job status.
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
        id, gtin, status, series, model_used,
        source_prompt, total_images, completed_images,
        results, error,
        created_at, started_at, completed_at
      FROM image_gen_jobs
      WHERE id = ${jobId} AND client_id = ${guard.client.id}
    `;

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const response: any = {
      id: job.id,
      gtin: job.gtin,
      status: job.status,
      series: job.series,
      model_used: job.model_used,
      progress: {
        completed: job.completed_images,
        total: job.total_images,
      },
      created_at: job.created_at,
      started_at: job.started_at,
      completed_at: job.completed_at,
    };

    if (job.error) {
      response.error = job.error;
    }

    if (job.status === 'complete' && job.results) {
      response.results = job.results;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[images/generate/:jobId] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job' },
      { status: 500 },
    );
  }
}
