import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import sql from '@/lib/db';
import { inngest } from '@/lib/inngest/client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/shopify — Receive Shopify webhook events
 *
 * Validates HMAC-SHA256 signature, identifies the store, and dispatches
 * to Inngest for async processing. Returns 200 immediately.
 */
export async function POST(request: Request) {
  try {
    // Read raw body for HMAC verification
    const rawBody = await request.text();
    const hmacHeader = request.headers.get('x-shopify-hmac-sha256');
    const shopDomain = request.headers.get('x-shopify-shop-domain');
    const topic = request.headers.get('x-shopify-topic');

    if (!hmacHeader || !shopDomain || !topic) {
      return NextResponse.json({ error: 'Missing headers' }, { status: 400 });
    }

    // Look up store by domain
    const [store] = await sql`
      SELECT id, webhook_secret, status FROM shopify_stores
      WHERE shop_domain = ${shopDomain}
    `;

    if (!store || !store.webhook_secret) {
      return NextResponse.json({ error: 'Unknown store' }, { status: 404 });
    }

    // Verify HMAC signature
    const computed = createHmac('sha256', store.webhook_secret)
      .update(rawBody)
      .digest('base64');

    if (computed !== hmacHeader) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);

    // Handle app/uninstalled synchronously — no product data
    if (topic === 'app/uninstalled') {
      await sql`
        UPDATE shopify_stores SET status = 'disconnected', updated_at = NOW()
        WHERE id = ${store.id}
      `;
      await sql`
        INSERT INTO shopify_sync_log (store_id, event_type, details)
        VALUES (${store.id}, 'app_uninstalled', '{}')
      `;
      return NextResponse.json({ ok: true });
    }

    // Dispatch product events to Inngest for async processing
    if (topic.startsWith('products/')) {
      await inngest.send({
        name: 'spatialable/shopify.product-sync',
        data: {
          storeId: store.id,
          shopifyProductId: payload.id,
          topic,
          payload,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[webhooks/shopify] Error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
