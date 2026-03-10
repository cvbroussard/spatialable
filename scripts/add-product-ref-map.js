/**
 * Add Product Ref Map + Thumbnail URL
 *
 * Creates the product_ref_map table for per-client product identifier mapping
 * and adds thumbnail_url column to product_assets for SEO thumbnails.
 * Safe to re-run (uses IF NOT EXISTS / DO $$ ... END $$).
 *
 * Usage:
 *   node scripts/add-product-ref-map.js
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set. Create .env.local from .env.local.example');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  console.log('Adding product ref map schema...\n');

  // ── Table: product_ref_map ──────────────────────────────────────────
  console.log('=== Tables ===');

  await sql`
    CREATE TABLE IF NOT EXISTS product_ref_map (
      id SERIAL PRIMARY KEY,
      client_id UUID NOT NULL REFERENCES clients(id),
      external_ref TEXT NOT NULL,
      canonical_ref TEXT NOT NULL,
      match_type TEXT NOT NULL DEFAULT 'manual',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(client_id, external_ref)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_product_ref_map_client ON product_ref_map(client_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_product_ref_map_canonical ON product_ref_map(canonical_ref)`;
  console.log('  + product_ref_map');

  // ── New column on product_assets ────────────────────────────────────
  console.log('\n=== Alter product_assets ===');

  await sql`DO $$ BEGIN
    ALTER TABLE product_assets ADD COLUMN thumbnail_url TEXT;
  EXCEPTION WHEN duplicate_column THEN NULL; END $$`;
  console.log('  + product_assets.thumbnail_url');

  console.log('\nDone. Product ref map schema ready.');
}

main().catch((err) => {
  console.error('Failed to add product ref map schema:', err);
  process.exit(1);
});
