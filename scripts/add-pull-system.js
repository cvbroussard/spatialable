/**
 * Add Pull System — Migration Script
 *
 * Extends brand_targets and source_images with pull configuration columns.
 * Creates pull_runs table for tracking pull execution.
 * Safe to re-run (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
 *
 * Usage:
 *   node scripts/add-pull-system.js
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set. Create .env.local from .env.local.example');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  console.log('Adding pull system schema...\n');

  // ── Extend brand_targets with pull configuration ──────────────────────

  console.log('=== brand_targets — pull config columns ===');

  await sql`ALTER TABLE brand_targets ADD COLUMN IF NOT EXISTS sitemaps TEXT[] DEFAULT '{}'`;
  console.log('  + sitemaps');

  await sql`ALTER TABLE brand_targets ADD COLUMN IF NOT EXISTS importer_key TEXT NOT NULL DEFAULT 'shopify-api'`;
  console.log('  + importer_key');

  await sql`ALTER TABLE brand_targets ADD COLUMN IF NOT EXISTS url_pattern_include TEXT`;
  console.log('  + url_pattern_include');

  await sql`ALTER TABLE brand_targets ADD COLUMN IF NOT EXISTS url_pattern_exclude TEXT`;
  console.log('  + url_pattern_exclude');

  await sql`ALTER TABLE brand_targets ADD COLUMN IF NOT EXISTS request_delay_ms INT NOT NULL DEFAULT 500`;
  console.log('  + request_delay_ms');

  await sql`ALTER TABLE brand_targets ADD COLUMN IF NOT EXISTS last_pull_at TIMESTAMPTZ`;
  console.log('  + last_pull_at');

  await sql`ALTER TABLE brand_targets ADD COLUMN IF NOT EXISTS discovered_count INT NOT NULL DEFAULT 0`;
  console.log('  + discovered_count');

  await sql`ALTER TABLE brand_targets ADD COLUMN IF NOT EXISTS pulled_count INT NOT NULL DEFAULT 0`;
  console.log('  + pulled_count');

  // ── Extend source_images with provenance tracking ─────────────────────

  console.log('\n=== source_images — provenance columns ===');

  await sql`ALTER TABLE source_images ADD COLUMN IF NOT EXISTS source_url TEXT`;
  console.log('  + source_url');

  await sql`ALTER TABLE source_images ADD COLUMN IF NOT EXISTS vendor TEXT`;
  console.log('  + vendor');

  await sql`ALTER TABLE source_images ADD COLUMN IF NOT EXISTS product_handle TEXT`;
  console.log('  + product_handle');

  await sql`ALTER TABLE source_images ADD COLUMN IF NOT EXISTS image_position INT`;
  console.log('  + image_position');

  // Dedup index — prevents re-importing the same product image
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_source_images_source_dedup
    ON source_images(source_url, image_position)
    WHERE source_url IS NOT NULL AND image_position IS NOT NULL`;
  console.log('  + idx_source_images_source_dedup (unique)');

  // ── pull_run_status enum ──────────────────────────────────────────────

  console.log('\n=== pull_runs ===');

  await sql`DO $$ BEGIN
    CREATE TYPE pull_run_status AS ENUM ('running', 'completed', 'failed', 'cancelled');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  console.log('  + pull_run_status enum');

  // ── pull_runs table ───────────────────────────────────────────────────

  await sql`
    CREATE TABLE IF NOT EXISTS pull_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      brand_target_id INT NOT NULL REFERENCES brand_targets(id),
      status pull_run_status NOT NULL DEFAULT 'running',
      discovered_urls INT NOT NULL DEFAULT 0,
      processed_count INT NOT NULL DEFAULT 0,
      created_count INT NOT NULL DEFAULT 0,
      skipped_count INT NOT NULL DEFAULT 0,
      failed_count INT NOT NULL DEFAULT 0,
      current_url TEXT,
      errors JSONB NOT NULL DEFAULT '[]',
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `;
  console.log('  + pull_runs table');

  await sql`CREATE INDEX IF NOT EXISTS idx_pull_runs_brand ON pull_runs(brand_target_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_pull_runs_status ON pull_runs(status)`;
  console.log('  + indexes');

  console.log('\nDone. Pull system schema applied.');
}

main().catch((err) => {
  console.error('Failed to apply pull system migration:', err);
  process.exit(1);
});
