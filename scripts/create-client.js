/**
 * Create API Client
 *
 * Generates a new API client with a random key, hashes it,
 * and inserts into the clients table.
 *
 * The plaintext API key is printed ONCE — it is never stored.
 *
 * Usage:
 *   node scripts/create-client.js --name "RetailSpec" --tier internal
 *   node scripts/create-client.js --name "Partner App" --tier partner --webhook https://example.com/webhook
 */

const { neon } = require('@neondatabase/serverless');
const { hash, genSalt } = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { name: '', tier: 'internal', webhook: null };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
      result.name = args[++i];
    } else if (args[i] === '--tier' && args[i + 1]) {
      result.tier = args[++i];
    } else if (args[i] === '--webhook' && args[i + 1]) {
      result.webhook = args[++i];
    }
  }

  return result;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const config = parseArgs();
  if (!config.name) {
    console.error('Usage: node scripts/create-client.js --name "Client Name" [--tier internal|partner|commercial] [--webhook URL]');
    process.exit(1);
  }

  const validTiers = ['internal', 'partner', 'commercial'];
  if (!validTiers.includes(config.tier)) {
    console.error(`Invalid tier "${config.tier}". Must be: ${validTiers.join(', ')}`);
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  // Generate a random 32-byte API key
  const apiKey = `mv_${crypto.randomBytes(32).toString('hex')}`;

  // Hash it
  const salt = await genSalt(12);
  const apiKeyHash = await hash(apiKey, salt);

  // Insert
  const [client] = await sql`
    INSERT INTO clients (name, api_key_hash, tier, webhook_url)
    VALUES (${config.name}, ${apiKeyHash}, ${config.tier}::client_tier, ${config.webhook})
    RETURNING id, name, tier
  `;

  console.log('\n=== API Client Created ===');
  console.log(`  ID:   ${client.id}`);
  console.log(`  Name: ${client.name}`);
  console.log(`  Tier: ${client.tier}`);
  if (config.webhook) {
    console.log(`  Webhook: ${config.webhook}`);
  }
  console.log('');
  console.log('  API Key (save this — it will NOT be shown again):');
  console.log(`  ${apiKey}`);
  console.log('');
}

main().catch((err) => {
  console.error('Failed to create client:', err);
  process.exit(1);
});
