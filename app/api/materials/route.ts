import { NextRequest, NextResponse } from 'next/server';
import sql, { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth/api-key';

export const dynamic = 'force-dynamic';

/**
 * GET /api/materials — Browse material library.
 *
 * Query params:
 *   ?type=fabric/linen
 *   ?search=walnut
 *   ?source=poly_haven
 *   ?limit=50
 *   ?offset=0
 */
export async function GET(request: NextRequest) {
  try {
    const guard = await requireAuth(request);
    if (!guard.ok) return guard.response;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const source = searchParams.get('source');
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (type) {
      conditions.push(`material_type ILIKE $${paramIdx}`);
      values.push(`${type}%`);
      paramIdx++;
    }

    if (search) {
      conditions.push(`(name ILIKE $${paramIdx} OR material_type ILIKE $${paramIdx} OR $${paramIdx + 1} = ANY(tags))`);
      values.push(`%${search}%`, search.toLowerCase());
      paramIdx += 2;
    }

    if (source) {
      conditions.push(`source = $${paramIdx}::material_source`);
      values.push(source);
      paramIdx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRow] = await query(
      `SELECT COUNT(*)::int AS total FROM materials ${where}`,
      values,
    );

    const materials = await query(
      `SELECT * FROM materials ${where}
       ORDER BY material_type, name
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...values, limit, offset],
    );

    return NextResponse.json({
      materials,
      total: countRow.total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[materials] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch materials' },
      { status: 500 },
    );
  }
}
