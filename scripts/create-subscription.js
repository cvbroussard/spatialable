/**
 * Create Subscription + Generate Token
 *
 * Generates a subscription token for a client, hashes it with SHA-256,
 * and stores it in the subscriptions table. The plaintext token is
 * printed once and never stored.
 *
 * Usage:
 *   node scripts/create-subscription.js --client-id <uuid> --tier standard --domains "example.com,*.example.com"
 *   node scripts/create-subscription.js --client-id <uuid>  # defaults: tier=base, domains=localhost
 */

const { neon } = require('@neondatabase/serverless');
const { createHash, randomBytes } = require('crypto');
require('dotenv').config({ path: '.env.local' });

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { clientId: null, tier: 'base', domains: ['localhost'] };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--client-id' && args[i + 1]) {
      opts.clientId = args[++i];
    }
    if (args[i] === '--tier' && args[i + 1]) {
      opts.tier = args[++i];
    }
    if (args[i] === '--domains' && args[i + 1]) {
      opts.domains = args[++i].split(',').map((d) => d.trim());
    }
  }

  return opts;
}

function generateToken() {
  const random = randomBytes(32).toString('hex');
  return `sk_live_${random}`;
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

async function main() {
  const opts = parseArgs();

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set.');
    process.exit(1);
  }

  if (!opts.clientId) {
    console.error('--client-id required. Use scripts/create-client.js to create a client first.');
    process.exit(1);
  }

  const validTiers = ['base', 'standard', 'premium'];
  if (!validTiers.includes(opts.tier)) {
    console.error(`Invalid tier "${opts.tier}". Must be one of: ${validTiers.join(', ')}`);
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  // Verify client exists
  const [client] = await sql`
    SELECT id, name, tier FROM clients WHERE id = ${opts.clientId} AND is_active = true
  `;
  if (!client) {
    console.error(`Client not found or inactive: ${opts.clientId}`);
    process.exit(1);
  }

  // Generate token
  const token = generateToken();
  const tokenHash = hashToken(token);
  const tokenPrefix = token.slice(0, 16); // "sk_live_a1b2c3d4"

  // Insert subscription
  const [sub] = await sql`
    INSERT INTO subscriptions (
      client_id, token_prefix, token_hash, tier, domain_whitelist
    ) VALUES (
      ${opts.clientId},
      ${tokenPrefix},
      ${tokenHash},
      ${opts.tier}::subscription_tier,
      ${opts.domains}
    )
    RETURNING id, tier, domain_whitelist
  `;

  console.log('\nSubscription created:');
  console.log(`  ID:      ${sub.id}`);
  console.log(`  Client:  ${client.name} (${client.id})`);
  console.log(`  Tier:    ${sub.tier}`);
  console.log(`  Domains: ${sub.domain_whitelist.join(', ')}`);
  console.log(`\n  Token (save this — it will not be shown again):\n`);
  console.log(`  ${token}\n`);
}

main().catch((err) => {
  console.error('Failed to create subscription:', err);
  process.exit(1);
});
