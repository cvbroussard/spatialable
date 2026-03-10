/**
 * Seed Simulator Data
 *
 * Creates demo clients, subscriptions, style profiles, categories,
 * brands, products, and placeholder images for the simulator storefront.
 *
 * Generates placeholder images via sharp and uploads to R2.
 *
 * Usage:
 *   node scripts/seed-simulator.js
 *   node scripts/seed-simulator.js --clean    # Delete existing simulator data first
 */

const { neon } = require('@neondatabase/serverless');
const { hash, genSalt } = require('bcryptjs');
const { createHash, randomBytes } = require('crypto');
const sharp = require('sharp');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config({ path: '.env.local' });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DOMAIN_WHITELIST = ['simulator.spatialable.com', 'simulator.localhost', 'localhost'];

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET = process.env.R2_ASSETS_BUCKET || 'spatialable-assets';
const CDN_URL = process.env.R2_ASSETS_URL || 'https://cdn.assets.spatialable.com';

// ---------------------------------------------------------------------------
// Image generation
// ---------------------------------------------------------------------------

const CATEGORY_COLORS = {
  furniture: { bg: '#8B6914', accent: '#D4A84B' },
  jewelry: { bg: '#4A1942', accent: '#9B59B6' },
  lighting: { bg: '#B8860B', accent: '#F4C430' },
};

async function generateImage(width, height, label, colors) {
  const { bg, accent } = colors;

  // Create a gradient background with text
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${bg};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${accent};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#grad)" />
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
            font-family="system-ui, sans-serif" font-size="${Math.floor(width / 15)}"
            fill="white" font-weight="600" opacity="0.9">
        ${escapeXml(label)}
      </text>
      <text x="50%" y="${height * 0.62}" text-anchor="middle"
            font-family="system-ui, sans-serif" font-size="${Math.floor(width / 25)}"
            fill="white" opacity="0.5">
        SpatialAble Demo
      </text>
    </svg>`;

  return sharp(Buffer.from(svg))
    .resize(width, height)
    .webp({ quality: 80 })
    .toBuffer();
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function uploadImage(buffer, key) {
  await r2.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: 'image/webp',
  }));
  return `${CDN_URL}/${key}`;
}

// ---------------------------------------------------------------------------
// Token/key helpers
// ---------------------------------------------------------------------------

function generateToken() {
  return `sk_live_${randomBytes(32).toString('hex')}`;
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

async function hashApiKey(key) {
  const salt = await genSalt(12);
  return hash(key, salt);
}

// ---------------------------------------------------------------------------
// Data definitions
// ---------------------------------------------------------------------------

const STYLE_PROFILES = [
  {
    name: 'Warm Modern',
    primary_color: '#8B4513',
    secondary_color: '#D4A84B',
    accent_color: '#C87533',
    font_family: 'Georgia, serif',
    border_radius: '12px',
    background_color: '#FFFAF5',
    text_color: '#2C1810',
  },
  {
    name: 'Dark Elegant',
    primary_color: '#1A1A2E',
    secondary_color: '#16213E',
    accent_color: '#D4AF37',
    font_family: 'system-ui, sans-serif',
    border_radius: '4px',
    background_color: '#0F0F1A',
    text_color: '#E8E8E8',
  },
  {
    name: 'Clean Minimal',
    primary_color: '#111111',
    secondary_color: '#F5F5F5',
    accent_color: '#0066CC',
    font_family: 'Inter, system-ui, sans-serif',
    border_radius: '0',
    background_color: '#FFFFFF',
    text_color: '#333333',
  },
];

const CLIENTS = [
  { name: 'Luxe Furniture Co', tier: 'commercial', subTier: 'premium', styleIdx: 0 },
  { name: 'Gemstone Jewelry', tier: 'commercial', subTier: 'standard', styleIdx: 1 },
  { name: 'Modern Lighting', tier: 'partner', subTier: 'base', styleIdx: 2 },
];

const CATEGORIES = [
  { path: 'furniture', name: 'Furniture', parent: null },
  { path: 'furniture/seating', name: 'Seating', parent: 'furniture' },
  { path: 'furniture/seating/chairs', name: 'Chairs', parent: 'furniture/seating' },
  { path: 'furniture/seating/sofas', name: 'Sofas', parent: 'furniture/seating' },
  { path: 'furniture/tables', name: 'Tables', parent: 'furniture' },
  { path: 'furniture/tables/dining', name: 'Dining Tables', parent: 'furniture/tables' },
  { path: 'furniture/tables/coffee', name: 'Coffee Tables', parent: 'furniture/tables' },
  { path: 'jewelry', name: 'Jewelry', parent: null },
  { path: 'jewelry/rings', name: 'Rings', parent: 'jewelry' },
  { path: 'jewelry/necklaces', name: 'Necklaces', parent: 'jewelry' },
  { path: 'lighting', name: 'Lighting', parent: null },
  { path: 'lighting/pendants', name: 'Pendants', parent: 'lighting' },
  { path: 'lighting/floor-lamps', name: 'Floor Lamps', parent: 'lighting' },
];

const BRANDS = [
  { name: 'Artisan Home', slug: 'artisan-home' },
  { name: 'Gemcraft', slug: 'gemcraft' },
  { name: 'Lumiere', slug: 'lumiere' },
];

const PRODUCTS = [
  // Furniture — chairs
  { ref: 'SIM-CHAIR-001', name: 'Modern Lounge Chair', price: 899, compareAt: 1099, category: 'furniture/seating/chairs', brand: 'artisan-home', desc: 'Sculpted hardwood frame with premium upholstery. Clean lines meet exceptional comfort.' },
  { ref: 'SIM-CHAIR-002', name: 'Velvet Accent Chair', price: 649, compareAt: null, category: 'furniture/seating/chairs', brand: 'artisan-home', desc: 'Rich velvet upholstery on a solid walnut base. A statement piece for any room.' },
  // Furniture — sofas
  { ref: 'SIM-SOFA-001', name: 'Sectional Sofa', price: 2499, compareAt: 2999, category: 'furniture/seating/sofas', brand: 'artisan-home', desc: 'Modular sectional in premium performance fabric. Configure to fit your space.' },
  // Furniture — tables
  { ref: 'SIM-TABLE-001', name: 'Walnut Dining Table', price: 1899, compareAt: null, category: 'furniture/tables/dining', brand: 'artisan-home', desc: 'Solid walnut dining table with live edge detail. Seats eight comfortably.' },
  { ref: 'SIM-TABLE-002', name: 'Glass Coffee Table', price: 599, compareAt: 749, category: 'furniture/tables/coffee', brand: 'artisan-home', desc: 'Tempered glass top on a brushed brass frame. Modern elegance for your living room.' },
  // Jewelry — rings
  { ref: 'SIM-RING-001', name: 'Diamond Solitaire Ring', price: 3200, compareAt: null, category: 'jewelry/rings', brand: 'gemcraft', desc: '1.5ct round brilliant diamond on a platinum band. Classic and timeless.' },
  { ref: 'SIM-RING-002', name: 'Emerald Band Ring', price: 1850, compareAt: 2200, category: 'jewelry/rings', brand: 'gemcraft', desc: 'Channel-set emeralds on 18K yellow gold. Rich color meets refined design.' },
  // Jewelry — necklaces
  { ref: 'SIM-NECK-001', name: 'Pearl Pendant Necklace', price: 450, compareAt: null, category: 'jewelry/necklaces', brand: 'gemcraft', desc: 'Freshwater pearl on a sterling silver chain. Delicate and elegant.' },
  { ref: 'SIM-NECK-002', name: 'Gold Chain Necklace', price: 780, compareAt: 950, category: 'jewelry/necklaces', brand: 'gemcraft', desc: '14K gold box chain with lobster clasp. A versatile everyday piece.' },
  // Lighting — pendants
  { ref: 'SIM-PEND-001', name: 'Brass Pendant Light', price: 349, compareAt: null, category: 'lighting/pendants', brand: 'lumiere', desc: 'Hand-finished brass pendant with frosted glass shade. Warm ambient glow.' },
  { ref: 'SIM-PEND-002', name: 'Globe Pendant Light', price: 275, compareAt: 325, category: 'lighting/pendants', brand: 'lumiere', desc: 'Smoked glass globe on a matte black cord. Mid-century modern inspired.' },
  // Lighting — floor lamps
  { ref: 'SIM-LAMP-001', name: 'Arc Floor Lamp', price: 425, compareAt: null, category: 'lighting/floor-lamps', brand: 'lumiere', desc: 'Arching brass arm with marble base. Creates a dramatic reading nook.' },
  { ref: 'SIM-LAMP-002', name: 'Tripod Floor Lamp', price: 299, compareAt: 375, category: 'lighting/floor-lamps', brand: 'lumiere', desc: 'Oak tripod legs with linen drum shade. Scandinavian simplicity.' },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set.');
    process.exit(1);
  }

  const isClean = process.argv.includes('--clean');
  const sql = neon(process.env.DATABASE_URL);

  if (isClean) {
    console.log('Cleaning existing simulator data...');
    await sql`DELETE FROM simulator_products`;
    await sql`DELETE FROM product_assets WHERE product_ref LIKE 'SIM-%'`;
    await sql`DELETE FROM product_ref_map WHERE canonical_ref LIKE 'SIM-%'`;
    // simulator_clients references subscriptions + clients — delete in order
    const simClients = await sql`SELECT client_id, subscription_id FROM simulator_clients`;
    await sql`DELETE FROM simulator_clients`;
    for (const sc of simClients) {
      await sql`DELETE FROM subscriptions WHERE id = ${sc.subscription_id}`;
      await sql`DELETE FROM clients WHERE id = ${sc.client_id}`;
    }
    await sql`DELETE FROM editorial_assets WHERE name LIKE 'Simulator%'`;
    console.log('  Cleaned.\n');
  }

  // Check if already seeded
  const existing = await sql`SELECT COUNT(*) as count FROM simulator_clients`;
  if (parseInt(existing[0].count) > 0) {
    console.log('Simulator data already exists. Run with --clean to re-seed.');
    return;
  }

  console.log('Seeding simulator data...\n');

  // 1. Style profiles
  console.log('Creating style profiles...');
  const styleProfileIds = [];
  for (const sp of STYLE_PROFILES) {
    const [row] = await sql`
      INSERT INTO style_profiles (name, primary_color, secondary_color, accent_color, font_family, border_radius, background_color, text_color)
      VALUES (${sp.name}, ${sp.primary_color}, ${sp.secondary_color}, ${sp.accent_color}, ${sp.font_family}, ${sp.border_radius}, ${sp.background_color}, ${sp.text_color})
      ON CONFLICT DO NOTHING
      RETURNING id
    `;
    if (row) {
      styleProfileIds.push(row.id);
    } else {
      // Already exists — look it up
      const [existing] = await sql`SELECT id FROM style_profiles WHERE name = ${sp.name}`;
      styleProfileIds.push(existing.id);
    }
  }
  console.log(`  ${styleProfileIds.length} style profiles ready.`);

  // 2. Clients + subscriptions
  console.log('Creating clients and subscriptions...');
  const clientData = [];
  for (let i = 0; i < CLIENTS.length; i++) {
    const c = CLIENTS[i];
    const apiKey = `mv_${randomBytes(32).toString('hex')}`;
    const apiKeyHash = await hashApiKey(apiKey);

    const [client] = await sql`
      INSERT INTO clients (name, api_key_hash, tier)
      VALUES (${c.name}, ${apiKeyHash}, ${c.tier}::client_tier)
      RETURNING id
    `;

    const token = generateToken();
    const tokenHash = hashToken(token);
    const tokenPrefix = token.slice(0, 16);

    const [sub] = await sql`
      INSERT INTO subscriptions (client_id, token_prefix, token_hash, tier, domain_whitelist, style_profile_id)
      VALUES (${client.id}, ${tokenPrefix}, ${tokenHash}, ${c.subTier}::subscription_tier, ${DOMAIN_WHITELIST}, ${styleProfileIds[i]})
      RETURNING id
    `;

    const slug = c.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    await sql`
      INSERT INTO simulator_clients (slug, display_name, description, client_id, subscription_id, token_plaintext, tier, style_summary)
      VALUES (${slug}, ${c.name}, ${`Demo ${c.subTier} tier client`}, ${client.id}, ${sub.id}, ${token}, ${c.subTier}, ${JSON.stringify({ primaryColor: STYLE_PROFILES[i].primary_color, fontFamily: STYLE_PROFILES[i].font_family })})
    `;

    clientData.push({ clientId: client.id, subId: sub.id, token, tier: c.subTier, name: c.name });
    console.log(`  ${c.name} — ${c.subTier} tier`);
  }

  // 3. Form factors (categories)
  console.log('Creating categories...');
  const categoryIds = {};
  for (const cat of CATEGORIES) {
    const parentId = cat.parent ? categoryIds[cat.parent] : null;
    const [existing] = await sql`SELECT id FROM form_factors WHERE category_path = ${cat.path}`;
    if (existing) {
      categoryIds[cat.path] = existing.id;
    } else {
      const [row] = await sql`
        INSERT INTO form_factors (parent_id, category_path, name)
        VALUES (${parentId}, ${cat.path}, ${cat.name})
        RETURNING id
      `;
      categoryIds[cat.path] = row.id;
    }
  }
  console.log(`  ${Object.keys(categoryIds).length} categories ready.`);

  // 4. Brand taxonomy
  console.log('Creating brands...');
  for (const brand of BRANDS) {
    await sql`
      INSERT INTO brand_taxonomy (name, slug, is_active, product_count, created_at, updated_at)
      VALUES (${brand.name}, ${brand.slug}, true, 0, NOW(), NOW())
      ON CONFLICT (slug) DO UPDATE SET name = ${brand.name}
    `;
  }
  console.log(`  ${BRANDS.length} brands ready.`);

  // 5. Generate and upload placeholder images + create product assets
  console.log('Generating and uploading placeholder images...');
  let imageCount = 0;

  for (const product of PRODUCTS) {
    const rootCategory = product.category.split('/')[0];
    const colors = CATEGORY_COLORS[rootCategory] || CATEGORY_COLORS.furniture;

    // Hero image (800x600)
    const heroBuffer = await generateImage(800, 600, product.name, colors);
    const heroKey = `simulator/products/${product.ref}/hero.webp`;
    const heroUrl = await uploadImage(heroBuffer, heroKey);
    imageCount++;

    // Gallery images (only for non-lighting products — lighting demos base tier)
    const galleryUrls = [];
    if (rootCategory !== 'lighting') {
      for (let g = 1; g <= 3; g++) {
        const galleryBuffer = await generateImage(800, 600, `${product.name} — View ${g}`, colors);
        const galleryKey = `simulator/products/${product.ref}/gallery-${g}.webp`;
        const url = await uploadImage(galleryBuffer, galleryKey);
        galleryUrls.push(url);
        imageCount++;
      }
    }

    // Create product_assets rows
    await sql`
      INSERT INTO product_assets (product_ref, role, position, content_type, url, alt)
      VALUES (${product.ref}, 'hero', 0, 'image/webp', ${heroUrl}, ${product.name})
      ON CONFLICT (product_ref, position) DO UPDATE SET url = ${heroUrl}, alt = ${product.name}
    `;

    for (let g = 0; g < galleryUrls.length; g++) {
      await sql`
        INSERT INTO product_assets (product_ref, role, position, content_type, url, alt)
        VALUES (${product.ref}, 'gallery', ${g + 1}, 'image/webp', ${galleryUrls[g]}, ${`${product.name} view ${g + 1}`})
        ON CONFLICT (product_ref, position) DO UPDATE SET url = ${galleryUrls[g]}
      `;
    }

    // Create simulator_products row
    await sql`
      INSERT INTO simulator_products (product_ref, name, price, compare_at_price, description, category_path, brand_slug)
      VALUES (${product.ref}, ${product.name}, ${product.price}, ${product.compareAt}, ${product.desc}, ${product.category}, ${product.brand})
      ON CONFLICT (product_ref) DO UPDATE SET name = ${product.name}, price = ${product.price}
    `;

    process.stdout.write(`  ${product.ref} `);
  }
  console.log(`\n  ${PRODUCTS.length} products, ${imageCount} images uploaded.`);

  // 6. Product ref mappings (each client gets its own external refs)
  console.log('Creating product ref mappings...');
  for (const cd of clientData) {
    for (const product of PRODUCTS) {
      const externalRef = `${cd.name.split(' ')[0].toUpperCase()}-${product.ref}`;
      await sql`
        INSERT INTO product_ref_map (client_id, external_ref, canonical_ref, match_type)
        VALUES (${cd.clientId}, ${externalRef}, ${product.ref}, 'manual')
        ON CONFLICT (client_id, external_ref) DO NOTHING
      `;
    }
  }
  console.log('  Done.');

  // 7. Editorial assets (home page heroes)
  console.log('Creating editorial assets...');
  for (let i = 0; i < 2; i++) {
    const label = i === 0 ? 'Discover Spatial Commerce' : 'Premium 3D Product Experiences';
    const colors = i === 0 ? CATEGORY_COLORS.furniture : CATEGORY_COLORS.jewelry;
    const buffer = await generateImage(1200, 500, label, colors);
    const key = `simulator/editorial/hero-${i + 1}.webp`;
    const url = await uploadImage(buffer, key);

    await sql`
      INSERT INTO editorial_assets (name, page_scope, role, url, content_type, position, is_active, created_at, updated_at)
      VALUES (${`Simulator Hero ${i + 1}`}, 'home', 'hero', ${url}, 'image/webp', ${i}, true, NOW(), NOW())
    `;
  }
  console.log('  2 editorial heroes created.');

  // 8. Update brand product counts
  for (const brand of BRANDS) {
    const count = PRODUCTS.filter((p) => p.brand === brand.slug).length;
    await sql`
      UPDATE brand_taxonomy SET product_count = ${count}, updated_at = NOW()
      WHERE slug = ${brand.slug}
    `;
  }

  // Summary
  console.log('\n=== Simulator Seeded ===\n');
  for (const cd of clientData) {
    console.log(`  ${cd.name}`);
    console.log(`    Tier:      ${cd.tier}`);
    console.log(`    Client ID: ${cd.clientId}`);
    console.log(`    Token:     ${cd.token.slice(0, 20)}...`);
    console.log('');
  }
  console.log('  Visit: http://simulator.localhost:3000');
  console.log(`  Switch client: http://simulator.localhost:3000?asset_client_id=<CLIENT_ID>\n`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
