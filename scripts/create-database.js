/**
 * Create SpatialAble Database Schema
 *
 * Creates all tables, enums, and indexes in the Neon database.
 * Safe to re-run (uses IF NOT EXISTS / DO $$ ... END $$).
 *
 * Usage:
 *   node scripts/create-database.js
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set. Create .env.local from .env.local.example');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  console.log('Creating SpatialAble database schema...\n');

  // ── Enum types ──────────────────────────────────────────────────────────
  console.log('=== Enums ===');

  await sql`DO $$ BEGIN
    CREATE TYPE asset_specificity AS ENUM ('upc', 'sku', 'form_factor');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  console.log('  + asset_specificity');

  await sql`DO $$ BEGIN
    CREATE TYPE asset_status AS ENUM ('generating', 'review', 'approved', 'rejected', 'archived');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  console.log('  + asset_status');

  await sql`DO $$ BEGIN
    CREATE TYPE material_source AS ENUM ('poly_haven', 'ambientcg', 'manufacturer', 'scanned', 'custom');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  console.log('  + material_source');

  await sql`DO $$ BEGIN
    CREATE TYPE job_status AS ENUM (
      'queued', 'meshy_submitted', 'mesh_ready', 'material_matching',
      'materials_matched', 'blender_processing', 'post_processing',
      'review', 'complete', 'failed'
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  console.log('  + job_status');

  await sql`DO $$ BEGIN
    CREATE TYPE client_tier AS ENUM ('internal', 'partner', 'commercial');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  console.log('  + client_tier');

  // ── Tables ──────────────────────────────────────────────────────────────
  console.log('\n=== Tables ===');

  // Clients
  await sql`
    CREATE TABLE IF NOT EXISTS clients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      api_key_hash TEXT NOT NULL,
      tier client_tier NOT NULL DEFAULT 'internal',
      webhook_url TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  console.log('  + clients');

  // Form factors
  await sql`
    CREATE TABLE IF NOT EXISTS form_factors (
      id SERIAL PRIMARY KEY,
      parent_id INT REFERENCES form_factors(id),
      category_path TEXT NOT NULL,
      name TEXT NOT NULL,
      structural_attributes JSONB DEFAULT '{}',
      base_mesh_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_form_factors_category ON form_factors(category_path)`;
  console.log('  + form_factors');

  // Materials
  await sql`
    CREATE TABLE IF NOT EXISTS materials (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      material_type TEXT NOT NULL,
      source material_source NOT NULL DEFAULT 'custom',
      albedo_url TEXT,
      normal_url TEXT,
      roughness_url TEXT,
      metallic_url TEXT,
      ao_url TEXT,
      preview_url TEXT,
      tags TEXT[] DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_materials_type ON materials(material_type)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_materials_tags ON materials USING GIN(tags)`;
  console.log('  + materials');

  // Assets
  await sql`
    CREATE TABLE IF NOT EXISTS assets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      specificity asset_specificity NOT NULL,
      status asset_status NOT NULL DEFAULT 'generating',
      upc TEXT,
      manufacturer_sku TEXT,
      form_factor_id INT REFERENCES form_factors(id),
      glb_url TEXT,
      thumbnail_url TEXT,
      vertex_count INT,
      file_size_bytes BIGINT,
      source_images JSONB NOT NULL DEFAULT '[]',
      category_path TEXT,
      attributes JSONB DEFAULT '{}',
      tags TEXT[] DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_assets_upc ON assets(upc) WHERE upc IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_assets_sku ON assets(manufacturer_sku) WHERE manufacturer_sku IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_assets_form_factor ON assets(form_factor_id) WHERE form_factor_id IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status)`;
  console.log('  + assets');

  // Generation jobs
  await sql`
    CREATE TABLE IF NOT EXISTS generation_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID NOT NULL REFERENCES clients(id),
      status job_status NOT NULL DEFAULT 'queued',
      source_images JSONB NOT NULL,
      product_metadata JSONB DEFAULT '{}',
      meshy_task_id TEXT,
      raw_mesh_url TEXT,
      identified_materials JSONB,
      matched_material_ids INT[],
      final_asset_id UUID REFERENCES assets(id),
      error TEXT,
      attempts INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_jobs_client ON generation_jobs(client_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_jobs_status ON generation_jobs(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_jobs_meshy ON generation_jobs(meshy_task_id) WHERE meshy_task_id IS NOT NULL`;
  console.log('  + generation_jobs');

  // Asset usage
  await sql`
    CREATE TABLE IF NOT EXISTS asset_usage (
      id SERIAL PRIMARY KEY,
      asset_id UUID NOT NULL REFERENCES assets(id),
      client_id UUID NOT NULL REFERENCES clients(id),
      product_reference TEXT,
      first_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      access_count INT NOT NULL DEFAULT 1,
      UNIQUE(asset_id, client_id, product_reference)
    )
  `;
  console.log('  + asset_usage');

  console.log('\nDone. All tables created successfully.');
}

main().catch((err) => {
  console.error('Failed to create database schema:', err);
  process.exit(1);
});
