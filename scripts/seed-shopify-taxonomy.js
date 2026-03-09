/**
 * Seed Shopify Taxonomy Map
 *
 * Upserts default product_type → category_path mappings into
 * the shopify_taxonomy_map table. Safe to re-run.
 *
 * Usage:
 *   node scripts/seed-shopify-taxonomy.js
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

// Inline taxonomy to avoid TS import issues in CJS script
const DEFAULT_TAXONOMY = [
  // Furniture — Seating
  { shopify_type: 'Sofa', category_path: 'furniture/seating/sofa' },
  { shopify_type: 'Sofas', category_path: 'furniture/seating/sofa' },
  { shopify_type: 'Sectional', category_path: 'furniture/seating/sectional' },
  { shopify_type: 'Sectionals', category_path: 'furniture/seating/sectional' },
  { shopify_type: 'Loveseat', category_path: 'furniture/seating/loveseat' },
  { shopify_type: 'Accent Chair', category_path: 'furniture/seating/accent-chair' },
  { shopify_type: 'Accent Chairs', category_path: 'furniture/seating/accent-chair' },
  { shopify_type: 'Recliner', category_path: 'furniture/seating/recliner' },
  { shopify_type: 'Recliners', category_path: 'furniture/seating/recliner' },
  { shopify_type: 'Ottoman', category_path: 'furniture/seating/ottoman' },
  { shopify_type: 'Ottomans', category_path: 'furniture/seating/ottoman' },
  { shopify_type: 'Bench', category_path: 'furniture/seating/bench' },
  { shopify_type: 'Bar Stool', category_path: 'furniture/seating/bar-stool' },
  { shopify_type: 'Bar Stools', category_path: 'furniture/seating/bar-stool' },
  { shopify_type: 'Dining Chair', category_path: 'furniture/seating/dining-chair' },
  { shopify_type: 'Dining Chairs', category_path: 'furniture/seating/dining-chair' },
  // Furniture — Tables
  { shopify_type: 'Dining Table', category_path: 'furniture/tables/dining-table' },
  { shopify_type: 'Dining Tables', category_path: 'furniture/tables/dining-table' },
  { shopify_type: 'Coffee Table', category_path: 'furniture/tables/coffee-table' },
  { shopify_type: 'Coffee Tables', category_path: 'furniture/tables/coffee-table' },
  { shopify_type: 'End Table', category_path: 'furniture/tables/end-table' },
  { shopify_type: 'Side Table', category_path: 'furniture/tables/end-table' },
  { shopify_type: 'Console Table', category_path: 'furniture/tables/console-table' },
  { shopify_type: 'Desk', category_path: 'furniture/tables/desk' },
  { shopify_type: 'Desks', category_path: 'furniture/tables/desk' },
  // Furniture — Storage
  { shopify_type: 'Bookcase', category_path: 'furniture/storage/bookcase' },
  { shopify_type: 'Bookshelf', category_path: 'furniture/storage/bookcase' },
  { shopify_type: 'Dresser', category_path: 'furniture/storage/dresser' },
  { shopify_type: 'Nightstand', category_path: 'furniture/storage/nightstand' },
  { shopify_type: 'Cabinet', category_path: 'furniture/storage/cabinet' },
  { shopify_type: 'Sideboard', category_path: 'furniture/storage/sideboard' },
  { shopify_type: 'TV Stand', category_path: 'furniture/storage/tv-stand' },
  { shopify_type: 'Media Console', category_path: 'furniture/storage/tv-stand' },
  // Furniture — Bedroom
  { shopify_type: 'Bed', category_path: 'furniture/bedroom/bed' },
  { shopify_type: 'Beds', category_path: 'furniture/bedroom/bed' },
  { shopify_type: 'Bed Frame', category_path: 'furniture/bedroom/bed' },
  { shopify_type: 'Headboard', category_path: 'furniture/bedroom/headboard' },
  // Lighting
  { shopify_type: 'Table Lamp', category_path: 'lighting/table-lamp' },
  { shopify_type: 'Floor Lamp', category_path: 'lighting/floor-lamp' },
  { shopify_type: 'Chandelier', category_path: 'lighting/chandelier' },
  { shopify_type: 'Pendant Light', category_path: 'lighting/pendant' },
  { shopify_type: 'Pendant', category_path: 'lighting/pendant' },
  { shopify_type: 'Sconce', category_path: 'lighting/sconce' },
  { shopify_type: 'Wall Sconce', category_path: 'lighting/sconce' },
  // Decor
  { shopify_type: 'Mirror', category_path: 'decor/mirror' },
  { shopify_type: 'Mirrors', category_path: 'decor/mirror' },
  { shopify_type: 'Vase', category_path: 'decor/vase' },
  { shopify_type: 'Picture Frame', category_path: 'decor/frame' },
  { shopify_type: 'Candle', category_path: 'decor/candle' },
  { shopify_type: 'Clock', category_path: 'decor/clock' },
  { shopify_type: 'Sculpture', category_path: 'decor/sculpture' },
  // Textiles
  { shopify_type: 'Rug', category_path: 'textiles/rug' },
  { shopify_type: 'Rugs', category_path: 'textiles/rug' },
  { shopify_type: 'Throw Pillow', category_path: 'textiles/pillow' },
  { shopify_type: 'Curtains', category_path: 'textiles/curtain' },
  { shopify_type: 'Throw Blanket', category_path: 'textiles/throw' },
  // Outdoor
  { shopify_type: 'Outdoor Sofa', category_path: 'outdoor/seating/sofa' },
  { shopify_type: 'Outdoor Chair', category_path: 'outdoor/seating/chair' },
  { shopify_type: 'Outdoor Table', category_path: 'outdoor/tables/dining-table' },
  { shopify_type: 'Planter', category_path: 'outdoor/planter' },
  // Kitchen & Bath
  { shopify_type: 'Faucet', category_path: 'kitchen-bath/faucet' },
  { shopify_type: 'Sink', category_path: 'kitchen-bath/sink' },
  { shopify_type: 'Vanity', category_path: 'kitchen-bath/vanity' },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set.');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  console.log('Seeding Shopify taxonomy map...\n');

  let inserted = 0;
  let updated = 0;

  for (const entry of DEFAULT_TAXONOMY) {
    const [result] = await sql`
      INSERT INTO shopify_taxonomy_map (shopify_type, category_path)
      VALUES (${entry.shopify_type}, ${entry.category_path})
      ON CONFLICT (shopify_type) DO UPDATE SET category_path = ${entry.category_path}
      RETURNING (xmax = 0) AS is_insert
    `;
    if (result.is_insert) {
      inserted++;
    } else {
      updated++;
    }
  }

  console.log(`  Inserted: ${inserted}`);
  console.log(`  Updated:  ${updated}`);
  console.log(`  Total:    ${DEFAULT_TAXONOMY.length}`);
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
