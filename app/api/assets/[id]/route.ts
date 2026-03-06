import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAuth } from '@/lib/auth/api-key';

export const dynamic = 'force-dynamic';

/**
 * GET /api/assets/:id — Single asset detail.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireAuth(request);
    if (!guard.ok) return guard.response;

    const { id } = await params;

    const [asset] = await sql`
      SELECT * FROM assets WHERE id = ${id}
    `;

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    return NextResponse.json({ asset });
  } catch (error) {
    console.error('[assets/:id] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch asset' },
      { status: 500 },
    );
  }
}
