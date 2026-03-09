/**
 * Add Source Image Curation Tables
 *
 * Adds: source_funnel, curation_status, survey_status enums
 *       brand_targets, source_images tables
 *
 * Safe to re-run (uses IF NOT EXISTS / DO $$ ... END $$).
 *
 * Usage:
 *   node scripts/add-source-tables.js
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set. Create .env.local from .env.local.example');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  console.log('Adding source image curation tables...\n');

  // ── Enum types ──────────────────────────────────────────────────────────
  console.log('=== Enums ===');

  await sql`DO $$ BEGIN
    CREATE TYPE source_funnel AS ENUM (
      'brand_pull', 'library', 'web_search', 'ai_generated', 'partner'
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  console.log('  + source_funnel');

  await sql`DO $$ BEGIN
    CREATE TYPE curation_status AS ENUM (
      'pending', 'candidate', 'queued', 'generating', 'rejected'
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  console.log('  + curation_status');

  await sql`DO $$ BEGIN
    CREATE TYPE survey_status AS ENUM (
      'targeting', 'surveying', 'pulling', 'curating', 'complete'
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  console.log('  + survey_status');

  // ── Tables ──────────────────────────────────────────────────────────────
  console.log('\n=== Tables ===');

  // Brand targets
  await sql`
    CREATE TABLE IF NOT EXISTS brand_targets (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      brand_name TEXT NOT NULL,
      website_url TEXT,
      status survey_status NOT NULL DEFAULT 'targeting',
      notes TEXT,
      image_count INT NOT NULL DEFAULT 0,
      candidate_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  console.log('  + brand_targets');

  // Source images
  await sql`
    CREATE TABLE IF NOT EXISTS source_images (
      id SERIAL PRIMARY KEY,
      image_url TEXT NOT NULL,
      original_url TEXT,
      thumbnail_url TEXT,
      funnel source_funnel NOT NULL,
      curation_status curation_status NOT NULL DEFAULT 'pending',
      brand_target_id INT REFERENCES brand_targets(id),

      product_name TEXT,
      category TEXT,
      upc TEXT,
      sku TEXT,
      description TEXT,

      width INT,
      height INT,
      file_size_bytes INT,
      content_type TEXT,

      quality_score REAL,
      background_type TEXT,
      angle TEXT,
      material_hints JSONB DEFAULT '[]',
      rejection_reason TEXT,

      product_group TEXT,

      generation_job_id UUID REFERENCES generation_jobs(id),

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  console.log('  + source_images');

  // ── Indexes ─────────────────────────────────────────────────────────────
  console.log('\n=== Indexes ===');

  await sql`CREATE INDEX IF NOT EXISTS idx_source_images_funnel ON source_images(funnel)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_source_images_status ON source_images(curation_status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_source_images_brand ON source_images(brand_target_id) WHERE brand_target_id IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_source_images_group ON source_images(product_group) WHERE product_group IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_source_images_category ON source_images(category) WHERE category IS NOT NULL`;
  console.log('  + 5 indexes on source_images');

  console.log('\nDone. Source image curation tables created successfully.');
}

main().catch((err) => {
  console.error('Failed to create source tables:', err);
  process.exit(1);
});
