import { cookies } from 'next/headers';
import sql from '@/lib/db';

export interface SimulatorClient {
  id: number;
  slug: string;
  display_name: string;
  description: string | null;
  client_id: string;
  subscription_id: string;
  token_plaintext: string;
  tier: string;
  logo_url: string | null;
  style_summary: Record<string, string>;
  is_active: boolean;
}

/**
 * Get the active simulator client from the cookie.
 * Falls back to the first active client if no cookie is set.
 */
export async function getActiveSimulatorClient(): Promise<SimulatorClient | null> {
  const cookieStore = await cookies();
  const clientId = cookieStore.get('sa_simulator_client')?.value;

  if (clientId) {
    const rows = await sql`
      SELECT * FROM simulator_clients
      WHERE client_id = ${clientId} AND is_active = true
      LIMIT 1
    `;
    if (rows.length > 0) return rows[0] as SimulatorClient;
  }

  // Fall back to first active client
  const rows = await sql`
    SELECT * FROM simulator_clients
    WHERE is_active = true
    ORDER BY id ASC LIMIT 1
  `;
  return (rows[0] as SimulatorClient) || null;
}

/**
 * Get all active simulator clients (for the switcher dropdown).
 */
export async function getAllSimulatorClients(): Promise<SimulatorClient[]> {
  return sql`
    SELECT * FROM simulator_clients
    WHERE is_active = true
    ORDER BY display_name ASC
  ` as Promise<SimulatorClient[]>;
}
