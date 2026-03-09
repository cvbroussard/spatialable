/**
 * Register Shopify Webhooks
 *
 * Registers webhook subscriptions for a connected Shopify store.
 * Topics: products/create, products/update, products/delete, app/uninstalled
 *
 * Usage:
 *   node scripts/shopify-register-webhooks.js --store-id <id> --callback-url <url>
 */

const { neon } = require('@neondatabase/serverless');
const { createDecipheriv } = require('crypto');
require('dotenv').config({ path: '.env.local' });

const API_VERSION = '2024-10';
const TOPICS = ['products/create', 'products/update', 'products/delete', 'app/uninstalled'];

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--store-id') opts.storeId = parseInt(args[++i], 10);
    if (args[i] === '--callback-url') opts.callbackUrl = args[++i];
  }
  return opts;
}

function decryptToken(encrypted, iv) {
  const hex = process.env.SHOPIFY_TOKEN_KEY;
  if (!hex || hex.length !== 64) throw new Error('SHOPIFY_TOKEN_KEY required');
  const key = Buffer.from(hex, 'hex');
  const ivBuf = Buffer.from(iv, 'base64');
  const combined = Buffer.from(encrypted, 'base64');
  const authTag = combined.subarray(combined.length - 16);
  const ciphertext = combined.subarray(0, combined.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', key, ivBuf);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function main() {
  const opts = parseArgs();
  if (!opts.storeId || !opts.callbackUrl) {
    console.error('Usage: node scripts/shopify-register-webhooks.js --store-id <id> --callback-url <url>');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  const [store] = await sql`SELECT * FROM shopify_stores WHERE id = ${opts.storeId}`;
  if (!store) { console.error(`Store ${opts.storeId} not found.`); process.exit(1); }

  const accessToken = decryptToken(store.access_token_encrypted, store.access_token_iv);
  const headers = { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' };

  console.log(`\nRegistering webhooks for ${store.shop_domain}...\n`);

  for (const topic of TOPICS) {
    const res = await fetch(
      `https://${store.shop_domain}/admin/api/${API_VERSION}/webhooks.json`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          webhook: {
            topic,
            address: opts.callbackUrl,
            format: 'json',
          },
        }),
      },
    );

    if (res.ok) {
      console.log(`  ✓ ${topic}`);
    } else if (res.status === 422) {
      console.log(`  ~ ${topic} (already registered)`);
    } else {
      console.error(`  ✗ ${topic}: ${res.status} ${await res.text()}`);
    }
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
