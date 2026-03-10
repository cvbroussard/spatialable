/**
 * Add Simulator Tables
 *
 * Creates simulator_clients and simulator_products tables
 * for the simulator storefront at simulator.spatialable.com.
 *
 * Safe to re-run (uses CREATE TABLE IF NOT EXISTS).
 *
 * Usage:
 *   node scripts/add-simulator-tables.js
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set.');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  console.log('Creating simulator tables...\n');

  // simulator_clients — stores plaintext tokens for <sa-media> rendering
  await sql`
    CREATE TABLE IF NOT EXISTS simulator_clients (
      id              SERIAL PRIMARY KEY,
      slug            TEXT NOT NULL UNIQUE,
      display_name    TEXT NOT NULL,
      description     TEXT,
      client_id       UUID NOT NULL REFERENCES clients(id),
      subscription_id UUID NOT NULL REFERENCES subscriptions(id),
      token_plaintext TEXT NOT NULL,
      tier            TEXT NOT NULL,
      logo_url        TEXT,
      style_summary   JSONB DEFAULT '{}',
      is_active       BOOLEAN NOT NULL DEFAULT true,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  console.log('  ✓ simulator_clients');

  // simulator_products — commerce metadata (name, price, description)
  await sql`
    CREATE TABLE IF NOT EXISTS simulator_products (
      id               SERIAL PRIMARY KEY,
      product_ref      TEXT NOT NULL UNIQUE,
      name             TEXT NOT NULL,
      price            NUMERIC(10,2) NOT NULL,
      compare_at_price NUMERIC(10,2),
      description      TEXT,
      category_path    TEXT NOT NULL,
      brand_slug       TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  console.log('  ✓ simulator_products');

  console.log('\nSimulator tables created successfully.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
