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
    CREATE TYPE asset_specificity AS ENUM ('upc', 'sku', 'form_factor', 'gtin');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  console.log('  + asset_specificity');

  await sql`DO $$ BEGIN
    CREATE TYPE asset_status AS ENUM ('generating', 'review', 'approved', 'rejected', 'archived');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  console.log('  + asset_status');

  await sql`DO $$ BEGIN
    CREATE TYPE material_source AS ENUM ('poly_haven', 'ambientcg', 'manufacturer', 'scanned', 'custom', 'swatch');
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
      external_id TEXT UNIQUE,
      albedo_url TEXT,
      normal_url TEXT,
      roughness_url TEXT,
      metallic_url TEXT,
      ao_url TEXT,
      height_url TEXT,
      preview_url TEXT,
      manufacturer_name TEXT,
      manufacturer_sku TEXT,
      color_hex TEXT,
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
      gtin TEXT,
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
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_gtin ON assets(gtin) WHERE gtin IS NOT NULL`;
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

  // ── Source image curation enums ──────────────────────────────────────────

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

  // ── Source image curation tables ────────────────────────────────────────

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
      gtin TEXT,
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
  await sql`CREATE INDEX IF NOT EXISTS idx_source_images_funnel ON source_images(funnel)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_source_images_status ON source_images(curation_status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_source_images_brand ON source_images(brand_target_id) WHERE brand_target_id IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_source_images_group ON source_images(product_group) WHERE product_group IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_source_images_category ON source_images(category) WHERE category IS NOT NULL`;
  console.log('  + source_images');

  // ── Embed delivery ─────────────────────────────────────────────────────

  await sql`DO $$ BEGIN
    CREATE TYPE subscription_tier AS ENUM ('base', 'standard', 'premium');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  console.log('  + subscription_tier');

  // Style profiles
  await sql`
    CREATE TABLE IF NOT EXISTS style_profiles (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      primary_color TEXT,
      secondary_color TEXT,
      accent_color TEXT,
      font_family TEXT,
      font_url TEXT,
      border_radius TEXT,
      background_color TEXT,
      text_color TEXT,
      custom_vars JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  console.log('  + style_profiles');

  // Subscriptions
  await sql`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID NOT NULL REFERENCES clients(id),
      token_prefix TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      tier subscription_tier NOT NULL DEFAULT 'base',
      domain_whitelist TEXT[] DEFAULT '{}',
      style_profile_id INT REFERENCES style_profiles(id),
      is_active BOOLEAN NOT NULL DEFAULT true,
      impression_limit INT,
      impressions_used INT NOT NULL DEFAULT 0,
      billing_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_client ON subscriptions(client_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(is_active) WHERE is_active = true`;
  console.log('  + subscriptions');

  // ── Product asset ordering ───────────────────────────────────────────────

  await sql`DO $$ BEGIN
    CREATE TYPE asset_role AS ENUM (
      'hero', 'gallery', 'detail', 'lifestyle', 'video', 'model'
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  console.log('  + asset_role');

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

  // ── Shopify integration ───────────────────────────────────────────────────

  await sql`DO $$ BEGIN
    CREATE TYPE shopify_store_status AS ENUM ('pending', 'active', 'paused', 'disconnected');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  console.log('  + shopify_store_status');

  await sql`DO $$ BEGIN
    CREATE TYPE shopify_match_type AS ENUM ('upc', 'sku', 'vendor_type', 'form_factor', 'gtin', 'none');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  console.log('  + shopify_match_type');

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
      gtin TEXT,
      sku TEXT,
      image_url TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(store_id, shopify_product_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_shopify_products_store ON shopify_products(store_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_shopify_products_upc ON shopify_products(upc) WHERE upc IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_shopify_products_gtin ON shopify_products(gtin) WHERE gtin IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_shopify_products_sku ON shopify_products(sku) WHERE sku IS NOT NULL`;
  console.log('  + shopify_products');

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

  // ── Swatch pipeline ──────────────────────────────────────────────────

  await sql`DO $$ BEGIN
    CREATE TYPE swatch_job_status AS ENUM (
      'uploaded', 'analyzing', 'preprocessing', 'deriving',
      'review', 'approved', 'rejected', 'failed'
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  console.log('  + swatch_job_status');

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

  // ── Image generation pipeline ─────────────────────────────────────────

  await sql`DO $$ BEGIN
    CREATE TYPE image_gen_status AS ENUM (
      'queued', 'generating', 'uploading', 'complete', 'failed'
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  console.log('  + image_gen_status');

  await sql`DO $$ BEGIN
    CREATE TYPE image_gen_series AS ENUM ('studio_angles');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  console.log('  + image_gen_series');

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
  await sql`CREATE INDEX IF NOT EXISTS idx_image_gen_jobs_gtin ON image_gen_jobs(gtin)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_image_gen_jobs_status ON image_gen_jobs(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_image_gen_jobs_client ON image_gen_jobs(client_id)`;
  console.log('  + image_gen_jobs');

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
