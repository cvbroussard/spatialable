/**
 * Migration: Add image generation tables
 *
 * Creates:
 *   - image_gen_status enum (queued, generating, uploading, complete, failed)
 *   - image_gen_series enum (studio_angles)
 *   - image_gen_jobs table
 *
 * Safe to re-run.
 *
 * Usage:
 *   node scripts/add-image-gen-tables.js
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  console.log('Adding image generation tables...\n');

  // ── Enums ──────────────────────────────────────────────────────────────

  await sql`DO $$ BEGIN
    CREATE TYPE image_gen_status AS ENUM (
      'queued', 'generating', 'uploading', 'complete', 'failed'
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  console.log('  + image_gen_status enum');

  await sql`DO $$ BEGIN
    CREATE TYPE image_gen_series AS ENUM ('studio_angles');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  console.log('  + image_gen_series enum');

  // ── Table ──────────────────────────────────────────────────────────────

  await sql`
    CREATE TABLE IF NOT EXISTS image_gen_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      gtin TEXT NOT NULL,
      client_id UUID NOT NULL REFERENCES clients(id),
      status image_gen_status NOT NULL DEFAULT 'queued',
      series image_gen_series NOT NULL DEFAULT 'studio_angles',
      model_used TEXT,
      source_prompt TEXT NOT NULL,
      source_refs TEXT[] DEFAULT '{}',
      total_images INT NOT NULL DEFAULT 10,
      completed_images INT NOT NULL DEFAULT 0,
      results JSONB NOT NULL DEFAULT '[]',
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ
    )
  `;
  console.log('  + image_gen_jobs table');

  // ── Indexes ────────────────────────────────────────────────────────────

  await sql`CREATE INDEX IF NOT EXISTS idx_image_gen_jobs_gtin ON image_gen_jobs(gtin)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_image_gen_jobs_status ON image_gen_jobs(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_image_gen_jobs_client ON image_gen_jobs(client_id)`;
  console.log('  + indexes (gtin, status, client_id)');

  console.log('\nDone. Image generation tables created successfully.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
