/**
 * Add Shopify Integration Tables
 *
 * Creates shopify_store_status and shopify_match_type enums, plus
 * shopify_stores, shopify_products, shopify_matches, shopify_taxonomy_map,
 * and shopify_sync_log tables.
 * Safe to re-run (uses IF NOT EXISTS / DO $$ ... END $$).
 *
 * Usage:
 *   node scripts/add-shopify-tables.js
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set.');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  console.log('Adding Shopify integration tables...\n');

  // ── Enums ──────────────────────────────────────────────────────────────────

  await sql`DO $$ BEGIN
    CREATE TYPE shopify_store_status AS ENUM ('pending', 'active', 'paused', 'disconnected');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  console.log('  + shopify_store_status enum');

  await sql`DO $$ BEGIN
    CREATE TYPE shopify_match_type AS ENUM ('upc', 'sku', 'vendor_type', 'form_factor', 'none');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  console.log('  + shopify_match_type enum');

  // ── Shopify Stores ─────────────────────────────────────────────────────────

  await sql`
    CREATE TABLE IF NOT EXISTS shopify_stores (
      id SERIAL PRIMARY KEY,
      client_id UUID NOT NULL REFERENCES clients(id),
      subscription_id UUID REFERENCES subscriptions(id),
      shop_domain TEXT NOT NULL UNIQUE,
      access_token_encrypted TEXT NOT NULL,
      access_token_iv TEXT NOT NULL,
      scopes TEXT[] DEFAULT '{}',
      status shopify_store_status NOT NULL DEFAULT 'pending',
      webhook_secret TEXT,
      last_sync_at TIMESTAMPTZ,
      product_count INT NOT NULL DEFAULT 0,
      matched_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_shopify_stores_client ON shopify_stores(client_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_shopify_stores_status ON shopify_stores(status)`;
  console.log('  + shopify_stores');

  // ── Shopify Products ───────────────────────────────────────────────────────

  await sql`
    CREATE TABLE IF NOT EXISTS shopify_products (
      id SERIAL PRIMARY KEY,
      store_id INT NOT NULL REFERENCES shopify_stores(id),
      shopify_product_id BIGINT NOT NULL,
      shopify_variant_id BIGINT,
      title TEXT NOT NULL,
      vendor TEXT,
      product_type TEXT,
      handle TEXT,
      upc TEXT,
      sku TEXT,
      image_url TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(store_id, shopify_product_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_shopify_products_store ON shopify_products(store_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_shopify_products_upc ON shopify_products(upc) WHERE upc IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_shopify_products_sku ON shopify_products(sku) WHERE sku IS NOT NULL`;
  console.log('  + shopify_products');

  // ── Shopify Matches ────────────────────────────────────────────────────────

  await sql`
    CREATE TABLE IF NOT EXISTS shopify_matches (
      id SERIAL PRIMARY KEY,
      shopify_product_id INT NOT NULL REFERENCES shopify_products(id) UNIQUE,
      asset_id UUID REFERENCES assets(id),
      match_type shopify_match_type NOT NULL DEFAULT 'none',
      match_confidence NUMERIC(3,2) NOT NULL DEFAULT 0.0,
      metafield_written BOOLEAN NOT NULL DEFAULT false,
      metafield_written_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_shopify_matches_asset ON shopify_matches(asset_id) WHERE asset_id IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_shopify_matches_type ON shopify_matches(match_type)`;
  console.log('  + shopify_matches');

  // ── Shopify Taxonomy Map ───────────────────────────────────────────────────

  await sql`
    CREATE TABLE IF NOT EXISTS shopify_taxonomy_map (
      id SERIAL PRIMARY KEY,
      shopify_type TEXT NOT NULL UNIQUE,
      category_path TEXT NOT NULL,
      form_factor_id INT REFERENCES form_factors(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  console.log('  + shopify_taxonomy_map');

  // ── Shopify Sync Log ───────────────────────────────────────────────────────

  await sql`
    CREATE TABLE IF NOT EXISTS shopify_sync_log (
      id SERIAL PRIMARY KEY,
      store_id INT NOT NULL REFERENCES shopify_stores(id),
      event_type TEXT NOT NULL,
      shopify_product_id BIGINT,
      details JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_shopify_sync_log_store ON shopify_sync_log(store_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_shopify_sync_log_event ON shopify_sync_log(event_type)`;
  console.log('  + shopify_sync_log');

  console.log('\nDone. Shopify integration tables created successfully.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
