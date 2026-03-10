/**
 * Add GTIN columns to assets, shopify_products, source_images.
 * Add 'gtin' to asset_specificity and shopify_match_type enums.
 * Backfill valid UPCs → normalized GTIN-14.
 *
 * Safe to re-run — uses IF NOT EXISTS / ADD VALUE IF NOT EXISTS.
 *
 * Usage:
 *   node scripts/add-gtin-columns.js
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

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

const VALID_LENGTHS = new Set([8, 12, 13, 14]);

function normalizeGtin(input) {
  const cleaned = (input || '').trim().replace(/[-\s]/g, '');
  if (!/^\d+$/.test(cleaned)) return null;
  if (!VALID_LENGTHS.has(cleaned.length)) return null;
  if (!validateCheckDigit(cleaned)) return null;
  return cleaned.padStart(14, '0');
}

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set.');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  console.log('Adding GTIN columns and backfilling...\n');

  // ── 1. Add enum values ──────────────────────────────────────────────────

  console.log('=== Enum Updates ===');

  await sql`ALTER TYPE asset_specificity ADD VALUE IF NOT EXISTS 'gtin'`;
  console.log("  + asset_specificity: added 'gtin'");

  await sql`ALTER TYPE shopify_match_type ADD VALUE IF NOT EXISTS 'gtin'`;
  console.log("  + shopify_match_type: added 'gtin'");

  // ── 2. Add columns ─────────────────────────────────────────────────────

  console.log('\n=== Column Additions ===');

  // assets.gtin
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS gtin TEXT`;
  console.log('  + assets.gtin');

  // Unique index on assets.gtin (partial — only non-null)
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_gtin ON assets(gtin) WHERE gtin IS NOT NULL`;
  console.log('  + idx_assets_gtin (unique, partial)');

  // shopify_products.gtin
  await sql`ALTER TABLE shopify_products ADD COLUMN IF NOT EXISTS gtin TEXT`;
  console.log('  + shopify_products.gtin');

  await sql`CREATE INDEX IF NOT EXISTS idx_shopify_products_gtin ON shopify_products(gtin) WHERE gtin IS NOT NULL`;
  console.log('  + idx_shopify_products_gtin');

  // source_images.gtin
  await sql`ALTER TABLE source_images ADD COLUMN IF NOT EXISTS gtin TEXT`;
  console.log('  + source_images.gtin');

  // ── 3. Backfill ─────────────────────────────────────────────────────────

  console.log('\n=== Backfill ===');

  // Backfill assets
  const assets = await sql`SELECT id, upc, specificity FROM assets WHERE upc IS NOT NULL AND gtin IS NULL`;
  let assetsFilled = 0;
  let assetsSkipped = 0;
  for (const row of assets) {
    const gtin = normalizeGtin(row.upc);
    if (gtin) {
      // Check for uniqueness conflict
      const existing = await sql`SELECT id FROM assets WHERE gtin = ${gtin} AND id != ${row.id} LIMIT 1`;
      if (existing.length > 0) {
        console.log(`  ! assets: GTIN conflict for ${row.upc} → ${gtin} (already on asset ${existing[0].id}), skipping ${row.id}`);
        assetsSkipped++;
        continue;
      }
      await sql`UPDATE assets SET gtin = ${gtin}, specificity = 'gtin' WHERE id = ${row.id}`;
      assetsFilled++;
    } else {
      assetsSkipped++;
    }
  }
  console.log(`  assets: ${assetsFilled} backfilled, ${assetsSkipped} skipped (invalid/conflict)`);

  // Backfill shopify_products
  const shopifyProducts = await sql`SELECT id, upc FROM shopify_products WHERE upc IS NOT NULL AND gtin IS NULL`;
  let shopifyFilled = 0;
  let shopifySkipped = 0;
  for (const row of shopifyProducts) {
    const gtin = normalizeGtin(row.upc);
    if (gtin) {
      await sql`UPDATE shopify_products SET gtin = ${gtin} WHERE id = ${row.id}`;
      shopifyFilled++;
    } else {
      shopifySkipped++;
    }
  }
  console.log(`  shopify_products: ${shopifyFilled} backfilled, ${shopifySkipped} skipped`);

  // Backfill source_images
  const sourceImages = await sql`SELECT id, upc FROM source_images WHERE upc IS NOT NULL AND gtin IS NULL`;
  let sourceFilled = 0;
  let sourceSkipped = 0;
  for (const row of sourceImages) {
    const gtin = normalizeGtin(row.upc);
    if (gtin) {
      await sql`UPDATE source_images SET gtin = ${gtin} WHERE id = ${row.id}`;
      sourceFilled++;
    } else {
      sourceSkipped++;
    }
  }
  console.log(`  source_images: ${sourceFilled} backfilled, ${sourceSkipped} skipped`);

  console.log('\nDone. GTIN columns added and backfilled.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
