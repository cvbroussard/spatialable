/**
 * Add Taxonomy Asset Tables
 *
 * Creates category_assets, brand_taxonomy, brand_assets, editorial_assets.
 * These support the embed home page and collection page rendering.
 * Safe to re-run (uses IF NOT EXISTS / DO $$ ... END $$).
 *
 * Usage:
 *   node scripts/add-taxonomy-assets.js
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set. Create .env.local from .env.local.example');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  console.log('Adding taxonomy asset schema...\n');

  // ── Enum: taxonomy_asset_status ──────────────────────────────────────
  console.log('=== Enums ===');

  await sql`DO $$ BEGIN
    CREATE TYPE taxonomy_asset_status AS ENUM ('generating', 'review', 'approved');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  console.log('  + taxonomy_asset_status');

  // ── Table: brand_taxonomy ────────────────────────────────────────────
  console.log('\n=== Tables ===');

  await sql`
    CREATE TABLE IF NOT EXISTS brand_taxonomy (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      product_count INT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_brand_taxonomy_slug ON brand_taxonomy(slug)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_brand_taxonomy_active ON brand_taxonomy(id) WHERE is_active = true`;
  console.log('  + brand_taxonomy');

  // ── Table: category_assets ───────────────────────────────────────────

  await sql`
    CREATE TABLE IF NOT EXISTS category_assets (
      id SERIAL PRIMARY KEY,
      form_factor_id INT NOT NULL REFERENCES form_factors(id),
      role TEXT NOT NULL,
      url TEXT NOT NULL,
      content_type TEXT,
      width INT,
      height INT,
      status taxonomy_asset_status NOT NULL DEFAULT 'generating',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(form_factor_id, role)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_category_assets_ff ON category_assets(form_factor_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_category_assets_status ON category_assets(status)`;
  console.log('  + category_assets');

  // ── Table: brand_assets ──────────────────────────────────────────────

  await sql`
    CREATE TABLE IF NOT EXISTS brand_assets (
      id SERIAL PRIMARY KEY,
      brand_id INT NOT NULL REFERENCES brand_taxonomy(id),
      role TEXT NOT NULL,
      url TEXT NOT NULL,
      content_type TEXT,
      width INT,
      height INT,
      status taxonomy_asset_status NOT NULL DEFAULT 'generating',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(brand_id, role)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_brand_assets_brand ON brand_assets(brand_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_brand_assets_status ON brand_assets(status)`;
  console.log('  + brand_assets');

  // ── Table: editorial_assets ──────────────────────────────────────────

  await sql`
    CREATE TABLE IF NOT EXISTS editorial_assets (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      page_scope TEXT NOT NULL,
      role TEXT NOT NULL,
      url TEXT NOT NULL,
      content_type TEXT,
      width INT,
      height INT,
      position INT NOT NULL DEFAULT 0,
      active_from TIMESTAMPTZ,
      active_until TIMESTAMPTZ,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_editorial_assets_scope ON editorial_assets(page_scope)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_editorial_assets_active ON editorial_assets(id) WHERE is_active = true`;
  console.log('  + editorial_assets');

  // ── Optional: link products to brands ────────────────────────────────
  // Add brand_id column to assets table for brand-level product grouping

  await sql`DO $$ BEGIN
    ALTER TABLE assets ADD COLUMN brand_id INT REFERENCES brand_taxonomy(id);
  EXCEPTION WHEN duplicate_column THEN NULL; END $$`;
  await sql`CREATE INDEX IF NOT EXISTS idx_assets_brand ON assets(brand_id) WHERE brand_id IS NOT NULL`;
  console.log('\n=== Alter assets ===');
  console.log('  + assets.brand_id');

  console.log('\nDone. Taxonomy asset schema ready.');
}

main().catch((err) => {
  console.error('Failed to add taxonomy asset schema:', err);
  process.exit(1);
});
