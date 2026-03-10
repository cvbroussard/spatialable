/**
 * Add Swatch-to-PBR Pipeline Schema
 *
 * Creates the swatch_jobs table, extends material_source enum,
 * and adds new columns to materials.
 * Safe to re-run (uses IF NOT EXISTS / DO $$ ... END $$).
 *
 * Usage:
 *   node scripts/add-swatch-pipeline.js
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set. Create .env.local from .env.local.example');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  console.log('Adding swatch pipeline schema...\n');

  // ── Enum: swatch_job_status ───────────────────────────────────────────
  console.log('=== Enums ===');

  await sql`DO $$ BEGIN
    CREATE TYPE swatch_job_status AS ENUM (
      'uploaded', 'analyzing', 'preprocessing', 'deriving',
      'review', 'approved', 'rejected', 'failed'
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  console.log('  + swatch_job_status');

  // ── Extend material_source with 'swatch' ──────────────────────────────
  await sql`ALTER TYPE material_source ADD VALUE IF NOT EXISTS 'swatch'`;
  console.log('  + material_source += swatch');

  // ── Table: swatch_jobs ────────────────────────────────────────────────
  console.log('\n=== Tables ===');

  await sql`
    CREATE TABLE IF NOT EXISTS swatch_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      swatch_image_url TEXT NOT NULL,
      manufacturer_name TEXT,
      manufacturer_sku TEXT,
      material_name TEXT,
      status swatch_job_status NOT NULL DEFAULT 'uploaded',
      vision_analysis JSONB,
      derived_material_type TEXT,
      derived_tags TEXT[] DEFAULT '{}',
      preprocessed_albedo_url TEXT,
      scenario_job_id TEXT,
      material_id INT REFERENCES materials(id),
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_swatch_jobs_status ON swatch_jobs(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_swatch_jobs_material ON swatch_jobs(material_id) WHERE material_id IS NOT NULL`;
  console.log('  + swatch_jobs');

  // ── New columns on materials ──────────────────────────────────────────
  console.log('\n=== Alter materials ===');

  await sql`DO $$ BEGIN
    ALTER TABLE materials ADD COLUMN manufacturer_name TEXT;
  EXCEPTION WHEN duplicate_column THEN NULL; END $$`;
  console.log('  + materials.manufacturer_name');

  await sql`DO $$ BEGIN
    ALTER TABLE materials ADD COLUMN manufacturer_sku TEXT;
  EXCEPTION WHEN duplicate_column THEN NULL; END $$`;
  console.log('  + materials.manufacturer_sku');

  await sql`DO $$ BEGIN
    ALTER TABLE materials ADD COLUMN color_hex TEXT;
  EXCEPTION WHEN duplicate_column THEN NULL; END $$`;
  console.log('  + materials.color_hex');

  await sql`DO $$ BEGIN
    ALTER TABLE materials ADD COLUMN height_url TEXT;
  EXCEPTION WHEN duplicate_column THEN NULL; END $$`;
  console.log('  + materials.height_url');

  console.log('\nDone. Swatch pipeline schema ready.');
}

main().catch((err) => {
  console.error('Failed to add swatch pipeline schema:', err);
  process.exit(1);
});
