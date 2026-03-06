import sql from '@/lib/db';
import { compare } from 'bcryptjs';
import type { AuthenticatedClient } from '@/lib/types';

/**
 * Validate a Bearer API key against the clients table.
 * Returns the authenticated client or null.
 */
export async function authenticateRequest(request: Request): Promise<AuthenticatedClient | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const apiKey = authHeader.slice(7);
  if (!apiKey) return null;

  try {
    const clients = await sql`
      SELECT id, name, api_key_hash, tier
      FROM clients
      WHERE is_active = true
    `;

    for (const client of clients) {
      if (await compare(apiKey, client.api_key_hash)) {
        return {
          id: client.id,
          name: client.name,
          tier: client.tier,
        };
      }
    }
  } catch (err) {
    console.error('[auth] Failed to validate API key:', err);
  }

  return null;
}

/**
 * Guard wrapper — returns 401 if not authenticated.
 */
export async function requireAuth(request: Request) {
  const client = await authenticateRequest(request);
  if (!client) {
    return {
      ok: false as const,
      response: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  return { ok: true as const, client };
}
