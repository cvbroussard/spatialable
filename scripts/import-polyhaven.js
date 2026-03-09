/**
 * Import PBR Textures from Poly Haven
 *
 * Downloads PBR map sets (2k resolution) from Poly Haven's CC0 library,
 * uploads to R2, and upserts into the materials table.
 *
 * Usage:
 *   node scripts/import-polyhaven.js                          # All relevant categories
 *   node scripts/import-polyhaven.js --dry-run                # List without downloading
 *   node scripts/import-polyhaven.js --categories wood,fabric # Specific categories
 *   node scripts/import-polyhaven.js --limit 5                # First N only
 */

const { neon } = require('@neondatabase/serverless');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config({ path: '.env.local' });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const POLYHAVEN_API = 'https://api.polyhaven.com';
const RESOLUTION = '2k';

const ASSETS_BUCKET = process.env.R2_ASSETS_BUCKET || 'spatialable-assets';
const ASSETS_URL = process.env.R2_ASSETS_URL || 'https://cdn.assets.spatialable.com';

// Categories we care about for retail product materials
const RELEVANT_CATEGORIES = new Set([
  'wood', 'fabric', 'leather', 'metal',
  'stone', 'rock', 'concrete', 'brick',
  'tiles', 'ceramic', 'glass', 'plaster',
  'ground', 'soil', 'sand',
]);

// Map Poly Haven categories to our material_type prefix
const CATEGORY_MAP = {
  wood: 'wood',
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
};

// PBR map type → Poly Haven file key
const MAP_TYPES = {
  albedo: { key: 'Diffuse', ext: 'jpg', contentType: 'image/jpeg' },
  normal: { key: 'nor_gl', ext: 'png', contentType: 'image/png' },
  roughness: { key: 'Rough', ext: 'png', contentType: 'image/png' },
  ao: { key: 'AO', ext: 'png', contentType: 'image/png' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { dryRun: false, categories: null, limit: null };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') opts.dryRun = true;
    if (args[i] === '--categories' && args[i + 1]) {
      opts.categories = new Set(args[++i].split(','));
    }
    if (args[i] === '--limit' && args[i + 1]) {
      opts.limit = parseInt(args[++i], 10);
    }
  }

  return opts;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'SpatialAble/1.0 (material-import)' },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${url} → ${res.status}`);
  return res.json();
}

async function downloadBuffer(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'SpatialAble/1.0 (material-import)' },
  });
  if (!res.ok) throw new Error(`Download failed: ${url} → ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function findPrimaryCategory(categories) {
  for (const cat of categories) {
    const lower = cat.toLowerCase();
    if (RELEVANT_CATEGORIES.has(lower)) return lower;
  }
  return null;
}

function buildMaterialType(category, assetId) {
  const prefix = CATEGORY_MAP[category] || category;
  // If prefix already has a slash (e.g. stone/concrete), use as-is
  if (prefix.includes('/')) return prefix;
  // Otherwise append the asset name
  return `${prefix}/${assetId.replace(/_/g, '-')}`;
}

function buildDisplayName(assetName) {
  // "wood_planks_017" → "Wood Planks 017"
  return assetName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
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
    console.error('R2 credentials not set. Use --dry-run to preview without uploading.');
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

  // 1. Fetch all textures
  console.log('Fetching Poly Haven texture list...');
  const allAssets = await fetchJson(`${POLYHAVEN_API}/assets?t=textures`);
  const assetIds = Object.keys(allAssets);
  console.log(`  Found ${assetIds.length} total textures\n`);

  // 2. Filter to relevant categories
  const categoryFilter = opts.categories || RELEVANT_CATEGORIES;
  const matching = [];

  for (const id of assetIds) {
    const asset = allAssets[id];
    const categories = (asset.categories || []).map((c) => c.toLowerCase());
    const primaryCat = categories.find((c) => categoryFilter.has(c));

    if (primaryCat) {
      matching.push({ id, asset, primaryCategory: primaryCat });
    }
  }

  console.log(`  ${matching.length} textures match selected categories`);

  // Apply limit
  const toProcess = opts.limit ? matching.slice(0, opts.limit) : matching;
  console.log(`  Processing ${toProcess.length} textures${opts.dryRun ? ' (dry run)' : ''}\n`);

  // 3. Process each texture
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const { id: assetId, asset, primaryCategory } = toProcess[i];
    const externalId = `polyhaven:${assetId}`;
    const materialType = buildMaterialType(primaryCategory, assetId);
    const displayName = buildDisplayName(asset.name || assetId);
    const tags = [...new Set([
      ...(asset.categories || []).map((c) => c.toLowerCase()),
      ...(asset.tags || []).map((t) => t.toLowerCase()),
    ])];

    const progress = `[${i + 1}/${toProcess.length}]`;

    if (opts.dryRun) {
      console.log(`${progress} ${assetId} → ${materialType} (${tags.join(', ')})`);
      imported++;
      continue;
    }

    try {
      // Check if already imported
      const [existing] = await sql`
        SELECT id FROM materials WHERE external_id = ${externalId}
      `;
      if (existing) {
        console.log(`${progress} ${assetId} — already imported, skipping`);
        skipped++;
        continue;
      }

      // Fetch file URLs
      const files = await fetchJson(`${POLYHAVEN_API}/files/${assetId}`);

      // Download and upload each PBR map
      const urls = {};

      for (const [mapName, mapConfig] of Object.entries(MAP_TYPES)) {
        const mapData = files[mapConfig.key];
        if (!mapData || !mapData[RESOLUTION]) continue;

        // Prefer jpg for albedo, png for others
        const formatData = mapData[RESOLUTION][mapConfig.ext] || mapData[RESOLUTION]['jpg'] || mapData[RESOLUTION]['png'];
        if (!formatData?.url) continue;

        const buffer = await downloadBuffer(formatData.url);
        const r2Key = `materials/polyhaven/${assetId}/${mapName}_${RESOLUTION}.${mapConfig.ext}`;

        await r2.send(new PutObjectCommand({
          Bucket: ASSETS_BUCKET,
          Key: r2Key,
          Body: buffer,
          ContentType: mapConfig.contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        }));

        urls[`${mapName}_url`] = `${ASSETS_URL}/${r2Key}`;
      }

      // Download preview thumbnail
      let previewUrl = null;
      if (asset.thumbnail_url) {
        try {
          const thumbBuffer = await downloadBuffer(asset.thumbnail_url);
          const thumbKey = `materials/polyhaven/${assetId}/preview.png`;
          await r2.send(new PutObjectCommand({
            Bucket: ASSETS_BUCKET,
            Key: thumbKey,
            Body: thumbBuffer,
            ContentType: 'image/png',
            CacheControl: 'public, max-age=31536000, immutable',
          }));
          previewUrl = `${ASSETS_URL}/${thumbKey}`;
        } catch {
          // Preview is optional, continue without it
        }
      }

      // Upsert into database
      await sql`
        INSERT INTO materials (
          name, material_type, source, external_id,
          albedo_url, normal_url, roughness_url, metallic_url, ao_url,
          preview_url, tags
        ) VALUES (
          ${displayName},
          ${materialType},
          'poly_haven'::material_source,
          ${externalId},
          ${urls.albedo_url || null},
          ${urls.normal_url || null},
          ${urls.roughness_url || null},
          ${null},
          ${urls.ao_url || null},
          ${previewUrl},
          ${tags}
        )
        ON CONFLICT (external_id) DO UPDATE SET
          albedo_url = EXCLUDED.albedo_url,
          normal_url = EXCLUDED.normal_url,
          roughness_url = EXCLUDED.roughness_url,
          ao_url = EXCLUDED.ao_url,
          preview_url = EXCLUDED.preview_url,
          tags = EXCLUDED.tags,
          updated_at = NOW()
      `;

      console.log(`${progress} ${assetId} → ${materialType} ✓ (${Object.keys(urls).length} maps)`);
      imported++;

      // Rate limit
      await sleep(1000);
    } catch (err) {
      console.error(`${progress} ${assetId} — ERROR: ${err.message}`);
      errors++;
    }
  }

  console.log(`\nDone. Imported: ${imported}, skipped: ${skipped}, errors: ${errors}`);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
