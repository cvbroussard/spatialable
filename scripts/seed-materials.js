/**
 * Seed Material Library
 *
 * Populates the materials table with common material types.
 * Phase 1: metadata only (no texture map URLs).
 * Phase 2: will add Poly Haven/AmbientCG texture URLs.
 *
 * Safe to re-run (uses ON CONFLICT).
 *
 * Usage:
 *   node scripts/seed-materials.js
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const MATERIALS = [
  // Wood
  { name: 'Oak Natural', material_type: 'wood/oak', source: 'custom', tags: ['wood', 'oak', 'natural', 'light'] },
  { name: 'Walnut Dark', material_type: 'wood/walnut', source: 'custom', tags: ['wood', 'walnut', 'dark', 'brown'] },
  { name: 'Maple Light', material_type: 'wood/maple', source: 'custom', tags: ['wood', 'maple', 'light', 'blonde'] },
  { name: 'Cherry Warm', material_type: 'wood/cherry', source: 'custom', tags: ['wood', 'cherry', 'warm', 'reddish'] },
  { name: 'Pine Natural', material_type: 'wood/pine', source: 'custom', tags: ['wood', 'pine', 'natural', 'knotted'] },
  { name: 'Teak Golden', material_type: 'wood/teak', source: 'custom', tags: ['wood', 'teak', 'golden', 'outdoor'] },

  // Fabric
  { name: 'Linen Natural', material_type: 'fabric/linen', source: 'custom', tags: ['fabric', 'linen', 'natural', 'beige'] },
  { name: 'Linen Gray', material_type: 'fabric/linen', source: 'custom', tags: ['fabric', 'linen', 'gray', 'cool'] },
  { name: 'Velvet Navy', material_type: 'fabric/velvet', source: 'custom', tags: ['fabric', 'velvet', 'navy', 'blue', 'luxury'] },
  { name: 'Velvet Emerald', material_type: 'fabric/velvet', source: 'custom', tags: ['fabric', 'velvet', 'emerald', 'green'] },
  { name: 'Cotton White', material_type: 'fabric/cotton', source: 'custom', tags: ['fabric', 'cotton', 'white', 'clean'] },
  { name: 'Tweed Gray', material_type: 'fabric/tweed', source: 'custom', tags: ['fabric', 'tweed', 'gray', 'textured'] },
  { name: 'Bouclé Cream', material_type: 'fabric/boucle', source: 'custom', tags: ['fabric', 'boucle', 'cream', 'textured'] },

  // Leather
  { name: 'Full Grain Cognac', material_type: 'leather/full-grain', source: 'custom', tags: ['leather', 'cognac', 'brown', 'premium'] },
  { name: 'Full Grain Black', material_type: 'leather/full-grain', source: 'custom', tags: ['leather', 'black', 'premium'] },
  { name: 'Top Grain Tan', material_type: 'leather/top-grain', source: 'custom', tags: ['leather', 'tan', 'brown'] },
  { name: 'Distressed Saddle', material_type: 'leather/distressed', source: 'custom', tags: ['leather', 'saddle', 'distressed', 'aged'] },

  // Metal
  { name: 'Brushed Steel', material_type: 'metal/steel', source: 'custom', tags: ['metal', 'steel', 'brushed', 'silver'] },
  { name: 'Matte Black Metal', material_type: 'metal/iron', source: 'custom', tags: ['metal', 'iron', 'matte', 'black'] },
  { name: 'Polished Brass', material_type: 'metal/brass', source: 'custom', tags: ['metal', 'brass', 'polished', 'gold'] },
  { name: 'Antique Brass', material_type: 'metal/brass', source: 'custom', tags: ['metal', 'brass', 'antique', 'aged'] },
  { name: 'Brushed Nickel', material_type: 'metal/nickel', source: 'custom', tags: ['metal', 'nickel', 'brushed', 'silver'] },
  { name: 'Copper Patina', material_type: 'metal/copper', source: 'custom', tags: ['metal', 'copper', 'patina', 'aged'] },
  { name: 'Chrome Polished', material_type: 'metal/chrome', source: 'custom', tags: ['metal', 'chrome', 'polished', 'mirror'] },

  // Stone / Ceramic
  { name: 'White Marble', material_type: 'stone/marble', source: 'custom', tags: ['stone', 'marble', 'white', 'veined'] },
  { name: 'Black Granite', material_type: 'stone/granite', source: 'custom', tags: ['stone', 'granite', 'black', 'speckled'] },
  { name: 'Concrete Gray', material_type: 'stone/concrete', source: 'custom', tags: ['stone', 'concrete', 'gray', 'industrial'] },
  { name: 'Ceramic White Glaze', material_type: 'ceramic/glazed', source: 'custom', tags: ['ceramic', 'white', 'glazed', 'smooth'] },

  // Glass
  { name: 'Clear Glass', material_type: 'glass/clear', source: 'custom', tags: ['glass', 'clear', 'transparent'] },
  { name: 'Smoked Glass', material_type: 'glass/smoked', source: 'custom', tags: ['glass', 'smoked', 'tinted', 'dark'] },
  { name: 'Frosted Glass', material_type: 'glass/frosted', source: 'custom', tags: ['glass', 'frosted', 'translucent'] },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  console.log('Seeding material library...\n');

  let inserted = 0;
  let skipped = 0;

  for (const mat of MATERIALS) {
    try {
      await sql`
        INSERT INTO materials (name, material_type, source, tags)
        VALUES (${mat.name}, ${mat.material_type}, ${mat.source}::material_source, ${mat.tags})
        ON CONFLICT DO NOTHING
      `;
      inserted++;
      console.log(`  + ${mat.material_type} — ${mat.name}`);
    } catch (err) {
      skipped++;
      console.log(`  ~ ${mat.name} (${err.message})`);
    }
  }

  console.log(`\nDone. Inserted: ${inserted}, skipped: ${skipped}`);
}

main().catch((err) => {
  console.error('Failed to seed materials:', err);
  process.exit(1);
});
