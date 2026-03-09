'use client';

import { useState, useEffect, useCallback } from 'react';
import { getClientsWithCounts } from './actions';

interface ClientRow {
  id: string;
  name: string;
  tier: string;
  is_active: boolean;
  webhook_url: string | null;
  created_at: string;
  subscription_count: number;
  store_count: number;
  total_impressions: number;
}

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    internal: 'bg-purple-100 text-purple-700',
    partner: 'bg-blue-100 text-blue-700',
    commercial: 'bg-green-100 text-green-700',
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${colors[tier] || 'bg-zinc-100 text-zinc-600'}`}>
      {tier}
    </span>
  );
}

export function ClientsClient() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getClientsWithCounts();
    setClients(result as ClientRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="text-zinc-400 text-sm">Loading clients...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Clients</h1>
        <p className="text-sm text-zinc-500 mt-1">{clients.length} registered client{clients.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-left">
              <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Name</th>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Tier</th>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Status</th>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Subscriptions</th>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Stores</th>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Impressions</th>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Created</th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-zinc-400 text-sm">
                  No clients registered yet
                </td>
              </tr>
            ) : (
              clients.map((client) => (
                <tr key={client.id} className="border-b border-zinc-50 even:bg-zinc-50">
                  <td className="px-4 py-2.5 font-medium text-zinc-900">{client.name}</td>
                  <td className="px-4 py-2.5"><TierBadge tier={client.tier} /></td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      client.is_active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'
                    }`}>
                      {client.is_active ? 'active' : 'inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-600">{client.subscription_count}</td>
                  <td className="px-4 py-2.5 text-zinc-600">{client.store_count}</td>
                  <td className="px-4 py-2.5 text-zinc-600">{client.total_impressions.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-zinc-500">{new Date(client.created_at).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
