import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { validateToken } from '@/lib/embed/auth';
import { validateOrigin, corsHeaders, originDenied } from '@/lib/embed/cors';

export const dynamic = 'force-dynamic';

/**
 * POST /api/embed/impression — Batch impression tracking beacon.
 *
 * Called by the loader to report deferred impressions.
 *
 * Body: {
 *   token: "sk_live_xxx",
 *   events: [
 *     { asset_id: "uuid", product_ref: "UPC123", type: "hero" },
 *     ...
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, events } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: 'Events array required' }, { status: 400 });
    }

    // Cap batch size
    if (events.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 events per batch' }, { status: 400 });
    }

    const result = await validateToken(token);
    if (!result) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const { subscription } = result;

    // Domain check
    const origin = request.headers.get('Origin');
    const matched = validateOrigin(origin, subscription.domain_whitelist);
    if (!matched) {
      return originDenied();
    }

    // Process events
    let tracked = 0;

    for (const event of events) {
      if (!event.asset_id) continue;

      try {
        await sql`
          INSERT INTO asset_usage (asset_id, client_id, product_reference)
          VALUES (${event.asset_id}, ${subscription.client_id}, ${event.product_ref || null})
          ON CONFLICT (asset_id, client_id, product_reference) DO UPDATE
          SET last_accessed_at = NOW(), access_count = asset_usage.access_count + 1
        `;
        tracked++;
      } catch {
        // Skip invalid asset IDs
      }
    }

    // Bulk increment subscription impressions
    if (tracked > 0) {
      await sql`
        UPDATE subscriptions
        SET impressions_used = impressions_used + ${tracked}, updated_at = NOW()
        WHERE id = ${subscription.id}
      `;
    }

    const response = NextResponse.json({ ok: true, tracked });

    const headers = corsHeaders(matched);
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }

    return response;
  } catch (error) {
    console.error('[embed/impression] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * OPTIONS /api/embed/impression — CORS preflight.
 */
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('Origin');
  if (!origin) return new NextResponse(null, { status: 204 });
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}
