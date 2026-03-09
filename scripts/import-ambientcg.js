/**
 * Import Material Metadata from ambientCG
 *
 * Downloads metadata and preview thumbnails from ambientCG's CC0 library.
 * PBR map URLs are NOT available via API v2 — records are created with
 * preview_url only. Full PBR maps can be added manually later.
 *
 * Usage:
 *   node scripts/import-ambientcg.js                          # All materials
 *   node scripts/import-ambientcg.js --dry-run                # List without importing
 *   node scripts/import-ambientcg.js --limit 10               # First N only
 */

const { neon } = require('@neondatabase/serverless');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config({ path: '.env.local' });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const AMBIENTCG_API = 'https://ambientcg.com/api/v2/full_json';
const PAGE_SIZE = 100;

const ASSETS_BUCKET = process.env.R2_ASSETS_BUCKET || 'spatialable-assets';
const ASSETS_URL = process.env.R2_ASSETS_URL || 'https://cdn.assets.spatialable.com';

// Map ambientCG displayCategory to our material_type prefix
const CATEGORY_MAP = {
  wood: 'wood',
  'wood floor': 'wood',
  'wood siding': 'wood',
  fabric: 'fabric',
  leather: 'leather',
  metal: 'metal',
  stone: 'stone',
  rock: 'stone',
  concrete: 'stone/concrete',
  brick: 'stone/brick',
  tiles: 'ceramic',
  ceramic: 'ceramic',
  glass: 'glass',
  plaster: 'plaster',
  ground: 'ground',
  soil: 'ground',
  sand: 'ground',
  gravel: 'ground',
  marble: 'stone/marble',
  granite: 'stone/granite',
  terrazzo: 'ceramic/terrazzo',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { dryRun: false, limit: null };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') opts.dryRun = true;
    if (args[i] === '--limit' && args[i + 1]) {
      opts.limit = parseInt(args[++i], 10);
    }
  }

  return opts;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${url} → ${res.status}`);
  return res.json();
}

async function downloadBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${url} → ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function mapCategory(displayCategory) {
  if (!displayCategory) return null;
  const lower = displayCategory.toLowerCase();
  return CATEGORY_MAP[lower] || null;
}

function buildMaterialType(categoryPrefix, assetId) {
  if (!categoryPrefix) return `other/${assetId.toLowerCase()}`;
  if (categoryPrefix.includes('/')) return categoryPrefix;
  return `${categoryPrefix}/${assetId.toLowerCase()}`;
}

function buildDisplayName(displayName) {
  return displayName || 'Unknown';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs();

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set.');
    process.exit(1);
  }

  if (!opts.dryRun && (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID)) {
    console.error('R2 credentials not set. Use --dry-run to preview.');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  let r2;
  if (!opts.dryRun) {
    r2 = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }

  console.log('Fetching ambientCG material list...');

  let offset = 0;
  let totalProcessed = 0;
  let imported = 0;
  let skipped = 0;
  let filtered = 0;
  let errors = 0;
  let totalAvailable = 0;

  while (true) {
    const data = await fetchJson(
      `${AMBIENTCG_API}?type=Material&limit=${PAGE_SIZE}&offset=${offset}&sort=Popular`,
    );

    if (offset === 0) {
      totalAvailable = data.numberOfResults;
      console.log(`  Found ${totalAvailable} total materials\n`);
    }

    const assets = data.foundAssets || [];
    if (assets.length === 0) break;

    for (const asset of assets) {
      if (opts.limit && totalProcessed >= opts.limit) break;

      const externalId = `ambientcg:${asset.assetId}`;
      const categoryPrefix = mapCategory(asset.displayCategory);

      // Skip categories we don't care about
      if (!categoryPrefix) {
        filtered++;
        continue;
      }

      totalProcessed++;
      const materialType = buildMaterialType(categoryPrefix, asset.assetId);
      const displayName = buildDisplayName(asset.displayName);
      const tags = (asset.tags || []).map((t) => t.toLowerCase());
      const progress = `[${totalProcessed}]`;

      if (opts.dryRun) {
        console.log(`${progress} ${asset.assetId} → ${materialType} (${asset.displayCategory})`);
        imported++;
        continue;
      }

      try {
        // Check if already imported
        const [existing] = await sql`
          SELECT id FROM materials WHERE external_id = ${externalId}
        `;
        if (existing) {
          skipped++;
          continue;
        }

        // Download preview thumbnail (256px PNG)
        let previewUrl = null;
        const thumbSrc = asset.previewImage?.['256-JPG-FFFFFF'] || asset.previewImage?.['128-PNG'];
        if (thumbSrc) {
          try {
            const thumbBuffer = await downloadBuffer(thumbSrc);
            const thumbKey = `materials/ambientcg/${asset.assetId}/preview.jpg`;
            await r2.send(new PutObjectCommand({
              Bucket: ASSETS_BUCKET,
              Key: thumbKey,
              Body: thumbBuffer,
              ContentType: 'image/jpeg',
              CacheControl: 'public, max-age=31536000, immutable',
            }));
            previewUrl = `${ASSETS_URL}/${thumbKey}`;
          } catch {
            // Preview optional
          }
        }

        // Insert metadata only (no PBR map URLs — not available via API v2)
        await sql`
          INSERT INTO materials (
            name, material_type, source, external_id,
            preview_url, tags
          ) VALUES (
            ${displayName},
            ${materialType},
            'ambientcg'::material_source,
            ${externalId},
            ${previewUrl},
            ${tags}
          )
          ON CONFLICT (external_id) DO UPDATE SET
            preview_url = EXCLUDED.preview_url,
            tags = EXCLUDED.tags,
            updated_at = NOW()
        `;

        console.log(`${progress} ${asset.assetId} → ${materialType} ✓`);
        imported++;

        await sleep(500);
      } catch (err) {
        console.error(`${progress} ${asset.assetId} — ERROR: ${err.message}`);
        errors++;
      }
    }

    if (opts.limit && totalProcessed >= opts.limit) break;

    offset += PAGE_SIZE;
    if (offset >= totalAvailable) break;

    // Rate limit between pages
    await sleep(1000);
  }

  console.log(`\nDone. Imported: ${imported}, skipped: ${skipped}, filtered: ${filtered}, errors: ${errors}`);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
