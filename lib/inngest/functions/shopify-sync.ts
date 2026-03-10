import { inngest } from '../client';
import sql from '@/lib/db';
import { normalizeGtin } from '@/lib/gtin';

// ---------------------------------------------------------------------------
// Shopify product sync — async handler for webhook events
//
// Dispatched by /api/webhooks/shopify for products/create, products/update,
// and products/delete events. Upserts product, runs matching, and optionally
// writes metafields.
// ---------------------------------------------------------------------------

export const shopifyProductSync = inngest.createFunction(
  { id: 'shopify-product-sync' },
  { event: 'spatialable/shopify.product-sync' },
  async ({ event, step }) => {
    const { storeId, shopifyProductId, topic, payload } = event.data;

    // ── products/delete ──────────────────────────────────────────────────
    if (topic === 'products/delete') {
      await step.run('mark-deleted', async () => {
        await sql`
          UPDATE shopify_products SET status = 'archived', synced_at = NOW()
          WHERE store_id = ${storeId} AND shopify_product_id = ${shopifyProductId}
        `;
        await sql`
          INSERT INTO shopify_sync_log (store_id, event_type, shopify_product_id, details)
          VALUES (${storeId}, 'product_delete', ${shopifyProductId}, '{}')
        `;
      });
      return { status: 'deleted' };
    }

    // ── products/create or products/update ────────────────────────────────
    const product = (await step.run('upsert-product', async () => {
      const primaryVariant = payload.variants?.[0];
      const barcode = primaryVariant?.barcode || null;
      const gtin = barcode ? normalizeGtin(barcode) : null;

      const [row] = await sql`
        INSERT INTO shopify_products (
          store_id, shopify_product_id, shopify_variant_id,
          title, vendor, product_type, handle, upc, gtin, sku, image_url, status, synced_at
        ) VALUES (
          ${storeId}, ${shopifyProductId}, ${primaryVariant?.id || null},
          ${payload.title}, ${payload.vendor || null}, ${payload.product_type || null},
          ${payload.handle}, ${barcode}, ${gtin}, ${primaryVariant?.sku || null},
          ${payload.images?.[0]?.src || null}, ${payload.status || 'active'}, NOW()
        )
        ON CONFLICT (store_id, shopify_product_id) DO UPDATE SET
          shopify_variant_id = EXCLUDED.shopify_variant_id,
          title = EXCLUDED.title,
          vendor = EXCLUDED.vendor,
          product_type = EXCLUDED.product_type,
          handle = EXCLUDED.handle,
          upc = EXCLUDED.upc,
          gtin = EXCLUDED.gtin,
          sku = EXCLUDED.sku,
          image_url = EXCLUDED.image_url,
          status = EXCLUDED.status,
          synced_at = NOW()
        RETURNING id, upc, gtin, sku, vendor, product_type
      `;

      return row;
    })) as { id: number; upc: string | null; gtin: string | null; sku: string | null; vendor: string | null; product_type: string | null };

    // Run matching cascade
    const match = await step.run('match-product', async () => {
      let matchType = 'none';
      let matchConfidence = 0.0;
      let assetId = null;

      // Tier 1: GTIN (normalized barcode → assets.gtin)
      if (product.gtin) {
        const [asset] = await sql`
          SELECT id FROM assets WHERE gtin = ${product.gtin} AND status = 'approved' LIMIT 1
        `;
        if (asset) { assetId = asset.id; matchType = 'gtin'; matchConfidence = 1.0; }
      }

      // Tier 1b: UPC fallback (raw barcode → assets.upc)
      if (!assetId && product.upc) {
        const [asset] = await sql`
          SELECT id FROM assets WHERE upc = ${product.upc} AND status = 'approved' LIMIT 1
        `;
        if (asset) { assetId = asset.id; matchType = 'upc'; matchConfidence = 1.0; }
      }

      // Tier 2: SKU
      if (!assetId && product.sku) {
        const [asset] = await sql`
          SELECT id FROM assets WHERE manufacturer_sku = ${product.sku} AND status = 'approved' LIMIT 1
        `;
        if (asset) { assetId = asset.id; matchType = 'sku'; matchConfidence = 1.0; }
      }

      // Tier 3: Vendor + product_type
      if (!assetId && product.vendor && product.product_type) {
        const [taxonomy] = await sql`
          SELECT category_path FROM shopify_taxonomy_map WHERE shopify_type = ${product.product_type}
        `;
        if (taxonomy) {
          const [asset] = await sql`
            SELECT id FROM assets
            WHERE attributes->>'vendor' = ${product.vendor}
              AND category_path = ${taxonomy.category_path}
              AND status = 'approved'
            LIMIT 1
          `;
          if (asset) { assetId = asset.id; matchType = 'vendor_type'; matchConfidence = 0.8; }
        }
      }

      // Tier 4: Form factor
      if (!assetId && product.product_type) {
        const [taxonomy] = await sql`
          SELECT form_factor_id FROM shopify_taxonomy_map
          WHERE shopify_type = ${product.product_type} AND form_factor_id IS NOT NULL
        `;
        if (taxonomy) {
          const [asset] = await sql`
            SELECT id FROM assets
            WHERE form_factor_id = ${taxonomy.form_factor_id}
              AND specificity = 'form_factor'
              AND status = 'approved'
            ORDER BY created_at DESC
            LIMIT 1
          `;
          if (asset) { assetId = asset.id; matchType = 'form_factor'; matchConfidence = 0.7; }
        }
      }

      // Upsert match
      await sql`
        INSERT INTO shopify_matches (shopify_product_id, asset_id, match_type, match_confidence)
        VALUES (${product.id}, ${assetId}, ${matchType}, ${matchConfidence})
        ON CONFLICT (shopify_product_id) DO UPDATE SET
          asset_id = EXCLUDED.asset_id,
          match_type = EXCLUDED.match_type,
          match_confidence = EXCLUDED.match_confidence,
          updated_at = NOW()
      `;

      return { assetId, matchType, matchConfidence };
    });

    // Log sync
    await step.run('log-sync', async () => {
      const eventType = topic === 'products/create' ? 'product_create' : 'product_update';
      await sql`
        INSERT INTO shopify_sync_log (store_id, event_type, shopify_product_id, details)
        VALUES (${storeId}, ${eventType}, ${shopifyProductId}, ${JSON.stringify({
          match_type: match.matchType,
          asset_id: match.assetId,
        })})
      `;
    });

    return { status: 'synced', match };
  },
);
