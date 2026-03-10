/**
 * Pull images from unmatched Shopify products for speculative generation
 *
 * Downloads featured images from Shopify products that have no SpatialAble
 * asset match, uploads them to R2, and inserts source_images rows for
 * the curation pipeline.
 *
 * Usage:
 *   node scripts/shopify-pull-images.js --store-id <id> [--limit 100]
 */

const { neon } = require('@neondatabase/serverless');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config({ path: '.env.local' });

// Inline GTIN normalization (CJS)
function calculateCheckDigit(d) {
  let s = 0;
  for (let i = d.length - 1; i >= 0; i--) {
    s += parseInt(d[i], 10) * ((d.length - 1 - i) % 2 === 0 ? 3 : 1);
  }
  return (10 - (s % 10)) % 10;
}
function normalizeGtin(input) {
  const c = (input || '').trim().replace(/[-\s]/g, '');
  if (!/^\d+$/.test(c) || ![8,12,13,14].includes(c.length)) return null;
  if (c.length < 2) return null;
  const check = parseInt(c[c.length - 1], 10);
  if (calculateCheckDigit(c.slice(0, -1)) !== check) return null;
  return c.padStart(14, '0');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { limit: 100 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--store-id') opts.storeId = parseInt(args[++i], 10);
    if (args[i] === '--limit') opts.limit = parseInt(args[++i], 10);
  }
  return opts;
}

function getR2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
  });
}

async function uploadToR2(r2, buffer, key, contentType) {
  const bucket = process.env.R2_ASSETS_BUCKET || 'spatialable-assets';
  await r2.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  const cdnUrl = process.env.R2_ASSETS_URL || 'https://cdn.assets.spatialable.com';
  return `${cdnUrl}/${key}`;
}

async function main() {
  const opts = parseArgs();
  if (!opts.storeId) {
    console.error('Usage: node scripts/shopify-pull-images.js --store-id <id> [--limit 100]');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  const r2 = getR2Client();

  const [store] = await sql`SELECT shop_domain FROM shopify_stores WHERE id = ${opts.storeId}`;
  if (!store) { console.error(`Store ${opts.storeId} not found.`); process.exit(1); }

  // Find unmatched products with images
  const products = await sql`
    SELECT p.id, p.title, p.vendor, p.product_type, p.upc, p.sku, p.image_url
    FROM shopify_products p
    JOIN shopify_matches m ON m.shopify_product_id = p.id
    WHERE p.store_id = ${opts.storeId}
      AND m.match_type = 'none'
      AND p.image_url IS NOT NULL
    ORDER BY p.id
    LIMIT ${opts.limit}
  `;

  console.log(`\nPulling images for ${products.length} unmatched products from ${store.shop_domain}...\n`);

  let pulled = 0;
  let failed = 0;

  for (const product of products) {
    try {
      // Download image
      const res = await fetch(product.image_url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const contentType = res.headers.get('content-type') || 'image/jpeg';
      const buffer = Buffer.from(await res.arrayBuffer());

      // Upload to R2
      const ext = contentType.includes('png') ? 'png' : 'jpg';
      const key = `source-images/shopify/${opts.storeId}/${product.id}.${ext}`;
      const imageUrl = await uploadToR2(r2, buffer, key, contentType);

      // Insert source_images row
      const gtin = product.upc ? normalizeGtin(product.upc) : null;
      await sql`
        INSERT INTO source_images (
          image_url, original_url, funnel, curation_status,
          product_name, category, upc, gtin, sku,
          width, height, file_size_bytes, content_type
        ) VALUES (
          ${imageUrl}, ${product.image_url}, 'partner', 'pending',
          ${product.title}, ${product.product_type}, ${product.upc}, ${gtin}, ${product.sku},
          NULL, NULL, ${buffer.length}, ${contentType}
        )
      `;

      console.log(`  ✓ ${product.title}`);
      pulled++;
    } catch (err) {
      console.error(`  ✗ ${product.title}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n  Pulled: ${pulled}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
