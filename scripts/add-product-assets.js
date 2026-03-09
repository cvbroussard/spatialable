/**
 * Add Product Assets Table
 *
 * Creates the asset_role enum and product_assets junction table
 * for ordered, multi-role product media sets.
 * Safe to re-run (uses IF NOT EXISTS / DO $$ ... END $$).
 *
 * Usage:
 *   node scripts/add-product-assets.js
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set.');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  console.log('Adding product_assets table...\n');

  // ── Enum ──────────────────────────────────────────────────────────────────

  await sql`DO $$ BEGIN
    CREATE TYPE asset_role AS ENUM (
      'hero', 'gallery', 'detail', 'lifestyle', 'video', 'model'
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  console.log('  + asset_role enum');

  // ── Product Assets ────────────────────────────────────────────────────────

  await sql`
    CREATE TABLE IF NOT EXISTS product_assets (
      id SERIAL PRIMARY KEY,
      product_ref TEXT NOT NULL,
      asset_id UUID REFERENCES assets(id),
      role asset_role NOT NULL,
      position INT NOT NULL,
      content_type TEXT,
      url TEXT NOT NULL,
      alt TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(product_ref, position),
      UNIQUE(product_ref, asset_id, role)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_product_assets_ref ON product_assets(product_ref)`;
  console.log('  + product_assets');

  console.log('\nDone. Product assets table created successfully.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
