/**
 * Register a Shopify store connection
 *
 * Creates a shopify_stores row with an encrypted access token.
 *
 * Usage:
 *   node scripts/add-shopify-store.js \
 *     --shop example.myshopify.com \
 *     --token shpat_xxxxx \
 *     --client-id <uuid> \
 *     --subscription-id <uuid>
 */

const { neon } = require('@neondatabase/serverless');
const { randomBytes, createCipheriv } = require('crypto');
require('dotenv').config({ path: '.env.local' });

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    opts[key] = args[i + 1];
  }
  return opts;
}

function encryptToken(plaintext) {
  const hex = process.env.SHOPIFY_TOKEN_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('SHOPIFY_TOKEN_KEY must be a 64-char hex string (32 bytes)');
  }
  const key = Buffer.from(hex, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([Buffer.from(encrypted, 'base64'), authTag]);

  return {
    encrypted: combined.toString('base64'),
    iv: iv.toString('base64'),
  };
}

async function main() {
  const opts = parseArgs();

  if (!opts.shop || !opts.token || !opts['client-id']) {
    console.error('Usage: node scripts/add-shopify-store.js --shop <domain> --token <shpat_xxx> --client-id <uuid> [--subscription-id <uuid>]');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set.');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  // Encrypt access token
  const { encrypted, iv } = encryptToken(opts.token);

  // Generate webhook secret
  const webhookSecret = randomBytes(32).toString('hex');

  // Insert store
  const [store] = await sql`
    INSERT INTO shopify_stores (
      client_id, subscription_id, shop_domain,
      access_token_encrypted, access_token_iv,
      scopes, status, webhook_secret
    ) VALUES (
      ${opts['client-id']},
      ${opts['subscription-id'] || null},
      ${opts.shop},
      ${encrypted},
      ${iv},
      ${['read_products', 'write_products']},
      'pending',
      ${webhookSecret}
    )
    RETURNING id, shop_domain
  `;

  console.log(`Store registered:`);
  console.log(`  ID:             ${store.id}`);
  console.log(`  Domain:         ${store.shop_domain}`);
  console.log(`  Webhook Secret: ${webhookSecret}`);
  console.log(`  Status:         pending`);
  console.log(`\nRun 'node scripts/shopify-ingest.js --store-id ${store.id}' to sync catalog.`);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
