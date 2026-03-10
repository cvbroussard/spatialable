/**
 * Shopify Catalog Ingest + Matching
 *
 * Primary onboarding script. Fetches all products from a connected Shopify
 * store, upserts into shopify_products, runs the 5-tier matching cascade,
 * and prints a hit rate summary.
 *
 * Usage:
 *   node scripts/shopify-ingest.js --store-id <id> [--dry-run]
 */

const { neon } = require('@neondatabase/serverless');
const { createDecipheriv } = require('crypto');
require('dotenv').config({ path: '.env.local' });

const API_VERSION = '2024-10';

// ---------------------------------------------------------------------------
// Inline GTIN validation (CJS — can't import from lib/gtin.ts)
// ---------------------------------------------------------------------------

function calculateCheckDigit(digitsWithoutCheck) {
  let sum = 0;
  for (let i = digitsWithoutCheck.length - 1; i >= 0; i--) {
    const d = parseInt(digitsWithoutCheck[i], 10);
    const weight = (digitsWithoutCheck.length - 1 - i) % 2 === 0 ? 3 : 1;
    sum += d * weight;
  }
  return (10 - (sum % 10)) % 10;
}

function validateCheckDigit(digits) {
  if (digits.length < 2) return false;
  const data = digits.slice(0, -1);
  const check = parseInt(digits[digits.length - 1], 10);
  return calculateCheckDigit(data) === check;
}

const GTIN_LENGTHS = new Set([8, 12, 13, 14]);

function normalizeGtin(input) {
  const cleaned = (input || '').trim().replace(/[-\s]/g, '');
  if (!/^\d+$/.test(cleaned)) return null;
  if (!GTIN_LENGTHS.has(cleaned.length)) return null;
  if (!validateCheckDigit(cleaned)) return null;
  return cleaned.padStart(14, '0');
}

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

async function fetchAllProducts(shopDomain, accessToken) {
  const products = [];
  let url = `https://${shopDomain}/admin/api/${API_VERSION}/products.json?limit=250&status=active`;
  const headers = { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' };
  let currentCalls = 0;

  while (url) {
    // Rate limiting
    if (currentCalls > 35) {
      await new Promise((r) => setTimeout(r, 1000));
    }

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Shopify API ${res.status}: ${await res.text()}`);

    const limit = res.headers.get('x-shopify-shop-api-call-limit');
    if (limit) currentCalls = parseInt(limit.split('/')[0], 10);

    const data = await res.json();
    if (data.products) products.push(...data.products);

    // Parse cursor pagination
    url = null;
    const link = res.headers.get('link');
    if (link) {
      const match = link.match(/<([^>]+)>;\s*rel="next"/);
      if (match) url = match[1];
    }

    process.stdout.write(`\r  Fetched ${products.length} products...`);
  }

  console.log(`\r  Fetched ${products.length} products total.`);
  return products;
}

async function main() {
  const opts = parseArgs();
  if (!opts.storeId) {
    console.error('Usage: node scripts/shopify-ingest.js --store-id <id> [--dry-run]');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  // 1. Load store
  const [store] = await sql`
    SELECT * FROM shopify_stores WHERE id = ${opts.storeId}
  `;
  if (!store) {
    console.error(`Store ${opts.storeId} not found.`);
    process.exit(1);
  }

  console.log(`\nIngesting catalog for ${store.shop_domain}...`);
  if (opts.dryRun) console.log('  (DRY RUN — no DB writes)\n');

  // 2. Decrypt access token
  const accessToken = decryptToken(store.access_token_encrypted, store.access_token_iv);

  // 3. Fetch all products
  const shopifyProducts = await fetchAllProducts(store.shop_domain, accessToken);

  // 4. Upsert into shopify_products
  console.log('\n  Upserting products...');
  const productRows = [];

  for (const sp of shopifyProducts) {
    const primaryVariant = sp.variants?.[0];
    const barcode = primaryVariant?.barcode || null;
    const gtin = barcode ? normalizeGtin(barcode) : null;
    const row = {
      store_id: store.id,
      shopify_product_id: sp.id,
      shopify_variant_id: primaryVariant?.id || null,
      title: sp.title,
      vendor: sp.vendor || null,
      product_type: sp.product_type || null,
      handle: sp.handle,
      upc: barcode,
      gtin,
      sku: primaryVariant?.sku || null,
      image_url: sp.images?.[0]?.src || null,
      status: sp.status,
    };

    if (!opts.dryRun) {
      const [inserted] = await sql`
        INSERT INTO shopify_products (
          store_id, shopify_product_id, shopify_variant_id,
          title, vendor, product_type, handle, upc, gtin, sku, image_url, status, synced_at
        ) VALUES (
          ${row.store_id}, ${row.shopify_product_id}, ${row.shopify_variant_id},
          ${row.title}, ${row.vendor}, ${row.product_type}, ${row.handle},
          ${row.upc}, ${row.gtin}, ${row.sku}, ${row.image_url}, ${row.status}, NOW()
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
      productRows.push(inserted);
    } else {
      productRows.push({ id: sp.id, ...row });
    }
  }

  console.log(`  Upserted ${productRows.length} products.`);

  // 5. Run matching cascade
  console.log('\n  Running matching cascade...');
  const matchCounts = { gtin: 0, upc: 0, sku: 0, vendor_type: 0, form_factor: 0, none: 0 };

  if (!opts.dryRun) {
    // Tier 0: Bulk GTIN match
    const gtins = productRows.filter((p) => p.gtin).map((p) => p.gtin);
    const gtinAssets = gtins.length > 0
      ? await sql`SELECT id, gtin FROM assets WHERE gtin = ANY(${gtins}) AND status = 'approved'`
      : [];
    const gtinMap = new Map(gtinAssets.map((a) => [a.gtin, a.id]));

    // Tier 1: Bulk UPC match
    const upcs = productRows.filter((p) => p.upc && !gtinMap.has(p.gtin)).map((p) => p.upc);
    const upcAssets = upcs.length > 0
      ? await sql`SELECT id, upc FROM assets WHERE upc = ANY(${upcs}) AND status = 'approved'`
      : [];
    const upcMap = new Map(upcAssets.map((a) => [a.upc, a.id]));

    // Tier 2: Bulk SKU match
    const skus = productRows.filter((p) => p.sku && !gtinMap.has(p.gtin) && !upcMap.has(p.upc)).map((p) => p.sku);
    const skuAssets = skus.length > 0
      ? await sql`SELECT id, manufacturer_sku FROM assets WHERE manufacturer_sku = ANY(${skus}) AND status = 'approved'`
      : [];
    const skuMap = new Map(skuAssets.map((a) => [a.manufacturer_sku, a.id]));

    // Load taxonomy for tiers 3 & 4
    const taxonomy = await sql`SELECT shopify_type, category_path, form_factor_id FROM shopify_taxonomy_map`;
    const typeToCategory = new Map(taxonomy.map((t) => [t.shopify_type, t.category_path]));
    const typeToFormFactor = new Map(taxonomy.filter((t) => t.form_factor_id).map((t) => [t.shopify_type, t.form_factor_id]));

    const matched = new Set();

    for (const product of productRows) {
      let matchType = 'none';
      let matchConfidence = 0.0;
      let assetId = null;

      // Tier 0: GTIN
      if (product.gtin && gtinMap.has(product.gtin)) {
        assetId = gtinMap.get(product.gtin);
        matchType = 'gtin';
        matchConfidence = 1.0;
      }
      // Tier 1: UPC
      else if (product.upc && upcMap.has(product.upc)) {
        assetId = upcMap.get(product.upc);
        matchType = 'upc';
        matchConfidence = 1.0;
      }
      // Tier 2: SKU
      else if (product.sku && skuMap.has(product.sku)) {
        assetId = skuMap.get(product.sku);
        matchType = 'sku';
        matchConfidence = 1.0;
      }
      // Tier 3: Vendor + product_type
      else if (product.vendor && product.product_type) {
        const categoryPath = typeToCategory.get(product.product_type);
        if (categoryPath) {
          const [asset] = await sql`
            SELECT id FROM assets
            WHERE attributes->>'vendor' = ${product.vendor}
              AND category_path = ${categoryPath}
              AND status = 'approved'
            LIMIT 1
          `;
          if (asset) {
            assetId = asset.id;
            matchType = 'vendor_type';
            matchConfidence = 0.8;
          }
        }
      }

      // Tier 4: Form factor
      if (!assetId && product.product_type) {
        const formFactorId = typeToFormFactor.get(product.product_type);
        if (formFactorId) {
          const [asset] = await sql`
            SELECT id FROM assets
            WHERE form_factor_id = ${formFactorId}
              AND specificity = 'form_factor'
              AND status = 'approved'
            ORDER BY created_at DESC
            LIMIT 1
          `;
          if (asset) {
            assetId = asset.id;
            matchType = 'form_factor';
            matchConfidence = 0.7;
          }
        }
      }

      matchCounts[matchType]++;

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
    }

    // 6. Update store counts
    const totalMatched = matchCounts.gtin + matchCounts.upc + matchCounts.sku + matchCounts.vendor_type + matchCounts.form_factor;
    await sql`
      UPDATE shopify_stores SET
        product_count = ${productRows.length},
        matched_count = ${totalMatched},
        last_sync_at = NOW(),
        status = 'active',
        updated_at = NOW()
      WHERE id = ${store.id}
    `;

    // 7. Log
    await sql`
      INSERT INTO shopify_sync_log (store_id, event_type, details)
      VALUES (${store.id}, 'full_sync', ${JSON.stringify({
        product_count: productRows.length,
        matched: totalMatched,
        by_tier: matchCounts,
      })})
    `;
  }

  // 8. Print summary
  const total = productRows.length;
  const totalMatched = matchCounts.gtin + matchCounts.upc + matchCounts.sku + matchCounts.vendor_type + matchCounts.form_factor;
  const hitRate = total > 0 ? ((totalMatched / total) * 100).toFixed(1) : '0.0';

  console.log('\n  ═══════════════════════════════════════');
  console.log(`  Hit Rate Report: ${store.shop_domain}`);
  console.log('  ═══════════════════════════════════════');
  console.log(`  Total products:  ${total}`);
  console.log(`  Matched:         ${totalMatched} (${hitRate}%)`);
  console.log(`  Unmatched:       ${total - totalMatched}`);
  console.log('  ───────────────────────────────────────');
  console.log(`  GTIN matches:    ${matchCounts.gtin}`);
  console.log(`  UPC matches:     ${matchCounts.upc}`);
  console.log(`  SKU matches:     ${matchCounts.sku}`);
  console.log(`  Vendor+type:     ${matchCounts.vendor_type}`);
  console.log(`  Form factor:     ${matchCounts.form_factor}`);
  console.log(`  No match:        ${matchCounts.none}`);
  console.log('  ═══════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('Ingest failed:', err);
  process.exit(1);
});
