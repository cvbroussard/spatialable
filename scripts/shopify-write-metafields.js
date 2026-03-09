/**
 * Write SpatialAble asset metafields to Shopify products
 *
 * For each matched product where metafield_written = FALSE, writes
 * spatialable.asset_id, spatialable.model_url, and spatialable.thumbnail_url
 * metafields to the Shopify product.
 *
 * Usage:
 *   node scripts/shopify-write-metafields.js --store-id <id> [--dry-run]
 */

const { neon } = require('@neondatabase/serverless');
const { createDecipheriv } = require('crypto');
require('dotenv').config({ path: '.env.local' });

const API_VERSION = '2024-10';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { dryRun: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--store-id') opts.storeId = parseInt(args[++i], 10);
    if (args[i] === '--dry-run') opts.dryRun = true;
  }
  return opts;
}

function decryptToken(encrypted, iv) {
  const hex = process.env.SHOPIFY_TOKEN_KEY;
  if (!hex || hex.length !== 64) throw new Error('SHOPIFY_TOKEN_KEY required');
  const key = Buffer.from(hex, 'hex');
  const ivBuf = Buffer.from(iv, 'base64');
  const combined = Buffer.from(encrypted, 'base64');
  const authTag = combined.subarray(combined.length - 16);
  const ciphertext = combined.subarray(0, combined.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', key, ivBuf);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

let currentCalls = 0;
async function writeMetafield(shopDomain, accessToken, productId, namespace, key, value, type) {
  if (currentCalls > 35) await new Promise((r) => setTimeout(r, 1000));

  const url = `https://${shopDomain}/admin/api/${API_VERSION}/products/${productId}/metafields.json`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ metafield: { namespace, key, value, type } }),
  });

  const limit = res.headers.get('x-shopify-shop-api-call-limit');
  if (limit) currentCalls = parseInt(limit.split('/')[0], 10);

  if (!res.ok) {
    throw new Error(`Metafield write ${res.status}: ${await res.text()}`);
  }
}

async function main() {
  const opts = parseArgs();
  if (!opts.storeId) {
    console.error('Usage: node scripts/shopify-write-metafields.js --store-id <id> [--dry-run]');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  const [store] = await sql`SELECT * FROM shopify_stores WHERE id = ${opts.storeId}`;
  if (!store) { console.error(`Store ${opts.storeId} not found.`); process.exit(1); }

  const accessToken = decryptToken(store.access_token_encrypted, store.access_token_iv);

  // Find unwritten matches
  const pending = await sql`
    SELECT
      p.shopify_product_id,
      p.title,
      m.asset_id,
      m.id AS match_id,
      a.thumbnail_url
    FROM shopify_matches m
    JOIN shopify_products p ON p.id = m.shopify_product_id
    JOIN assets a ON a.id = m.asset_id
    WHERE p.store_id = ${opts.storeId}
      AND m.match_type != 'none'
      AND m.metafield_written = false
  `;

  console.log(`\nWriting metafields for ${store.shop_domain}...`);
  console.log(`  ${pending.length} products pending.`);
  if (opts.dryRun) console.log('  (DRY RUN)\n');

  let written = 0;
  let failed = 0;

  for (const row of pending) {
    try {
      if (opts.dryRun) {
        console.log(`  [dry] ${row.title} → asset ${row.asset_id}`);
      } else {
        // Write asset_id
        await writeMetafield(store.shop_domain, accessToken,
          row.shopify_product_id, 'spatialable', 'asset_id',
          row.asset_id, 'single_line_text_field');

        // Write thumbnail_url
        if (row.thumbnail_url) {
          await writeMetafield(store.shop_domain, accessToken,
            row.shopify_product_id, 'spatialable', 'thumbnail_url',
            row.thumbnail_url, 'url');
        }

        // Mark as written
        await sql`
          UPDATE shopify_matches SET
            metafield_written = true,
            metafield_written_at = NOW(),
            updated_at = NOW()
          WHERE id = ${row.match_id}
        `;

        // Log
        await sql`
          INSERT INTO shopify_sync_log (store_id, event_type, shopify_product_id, details)
          VALUES (${store.id}, 'metafield_write', ${row.shopify_product_id}, ${JSON.stringify({
            asset_id: row.asset_id,
          })})
        `;

        console.log(`  ✓ ${row.title}`);
      }
      written++;
    } catch (err) {
      console.error(`  ✗ ${row.title}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n  Written: ${written}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
