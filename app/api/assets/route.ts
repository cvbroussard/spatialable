import { NextRequest, NextResponse } from 'next/server';
import sql, { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth/api-key';

export const dynamic = 'force-dynamic';

/**
 * GET /api/assets — List and search assets.
 *
 * Query params:
 *   ?status=approved       (default: approved)
 *   ?category=furniture/seating
 *   ?search=sofa
 *   ?limit=25
 *   ?offset=0
 */
export async function GET(request: NextRequest) {
  try {
    const guard = await requireAuth(request);
    if (!guard.ok) return guard.response;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'approved';
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25')));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));

    // Build query conditions
    const conditions: string[] = ['status = $1::asset_status'];
    const values: any[] = [status];
    let paramIdx = 2;

    if (category) {
      conditions.push(`category_path ILIKE $${paramIdx}`);
      values.push(`${category}%`);
      paramIdx++;
    }

    if (search) {
      conditions.push(`(category_path ILIKE $${paramIdx} OR upc = $${paramIdx + 1} OR manufacturer_sku = $${paramIdx + 1})`);
      values.push(`%${search}%`, search);
      paramIdx += 2;
    }

    const where = conditions.join(' AND ');

    const [countRow] = await query(
      `SELECT COUNT(*)::int AS total FROM assets WHERE ${where}`,
      values,
    );

    const assets = await query(
      `SELECT id, specificity, status, upc, manufacturer_sku,
              glb_url, thumbnail_url, vertex_count, file_size_bytes,
              category_path, tags, created_at
       FROM assets
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...values, limit, offset],
    );

    return NextResponse.json({
      assets,
      total: countRow.total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[assets] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assets' },
      { status: 500 },
    );
  }
}
