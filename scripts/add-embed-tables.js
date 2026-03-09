/**
 * Add Embed Tables — Subscriptions + Style Profiles
 *
 * Creates the subscription_tier enum, style_profiles table, and
 * subscriptions table needed for the <sa-media> embed component.
 * Safe to re-run (uses IF NOT EXISTS / DO $$ ... END $$).
 *
 * Usage:
 *   node scripts/add-embed-tables.js
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set.');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  console.log('Adding embed tables...\n');

  // ── Enum ──────────────────────────────────────────────────────────────────

  await sql`DO $$ BEGIN
    CREATE TYPE subscription_tier AS ENUM ('base', 'standard', 'premium');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  console.log('  + subscription_tier enum');

  // ── Style Profiles ────────────────────────────────────────────────────────

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

  // ── Subscriptions ─────────────────────────────────────────────────────────

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

  console.log('\nDone. Embed tables created successfully.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
