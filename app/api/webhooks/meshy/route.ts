import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/meshy — Meshy webhook callback.
 *
 * Placeholder for Phase 2 when we switch from polling to webhooks.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[meshy-webhook] Received:', JSON.stringify(body));

    // TODO: Phase 2 — handle Meshy completion webhooks
    // For now, the pipeline uses polling via Inngest steps

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[meshy-webhook] Error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 },
    );
  }
}
