/**
 * Add external_id column to materials table.
 *
 * Enables idempotent imports from external sources (Poly Haven, ambientCG).
 * Format: "polyhaven:{asset_id}" or "ambientcg:{asset_id}"
 *
 * Safe to re-run.
 *
 * Usage:
 *   node scripts/add-materials-external-id.js
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set.');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  console.log('Adding external_id column to materials table...\n');

  await sql`ALTER TABLE materials ADD COLUMN IF NOT EXISTS external_id TEXT UNIQUE`;
  console.log('  + external_id column added');

  await sql`CREATE INDEX IF NOT EXISTS idx_materials_external ON materials(external_id) WHERE external_id IS NOT NULL`;
  console.log('  + idx_materials_external index created');

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
