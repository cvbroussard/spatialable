'use client';

import { useState, useEffect, useCallback } from 'react';
import { getUsageStats } from './actions';

interface ClientUsage {
  id: string;
  name: string;
  tier: string;
  subscription_count: number;
  total_impressions: number;
  total_limit: number;
}

interface TopAsset {
  id: string;
  thumbnail_url: string | null;
  category_path: string | null;
  specificity: string;
  upc: string | null;
  manufacturer_sku: string | null;
  assignment_count: number;
}

interface TierUsage {
  tier: string;
  subscription_count: number;
  total_impressions: number;
}

interface UsageStats {
  totalImpressions: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  byClient: ClientUsage[];
  topAssets: TopAsset[];
  byTier: TierUsage[];
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-1">{label}</div>
      <div className="text-2xl font-bold text-zinc-900">{typeof value === 'number' ? value.toLocaleString() : value}</div>
      {sub && <div className="text-xs text-zinc-500 mt-1">{sub}</div>}
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    internal: 'bg-purple-100 text-purple-700',
    partner: 'bg-blue-100 text-blue-700',
    commercial: 'bg-green-100 text-green-700',
    base: 'bg-zinc-100 text-zinc-600',
    standard: 'bg-blue-100 text-blue-700',
    premium: 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${colors[tier] || 'bg-zinc-100 text-zinc-600'}`}>
      {tier}
    </span>
  );
}

export function UsageClient() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getUsageStats();
    setStats(result as UsageStats);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading || !stats) {
    return <div className="text-zinc-400 text-sm">Loading usage stats...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Usage</h1>
        <p className="text-sm text-zinc-500 mt-1">Impression metering &amp; asset utilization</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Impressions"
          value={stats.totalImpressions}
        />
        <StatCard
          label="Subscriptions"
          value={stats.totalSubscriptions}
          sub={`${stats.activeSubscriptions} active`}
        />
        {stats.byTier.map((t) => (
          <StatCard
            key={t.tier}
            label={`${t.tier} Tier`}
            value={t.total_impressions}
            sub={`${t.subscription_count} subscription${t.subscription_count !== 1 ? 's' : ''}`}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Usage by Client */}
        <div>
          <h2 className="text-lg font-bold text-zinc-900 mb-3">Usage by Client</h2>
          <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Client</th>
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Tier</th>
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Subs</th>
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Impressions</th>
                </tr>
              </thead>
              <tbody>
                {stats.byClient.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-zinc-400 text-sm">No clients yet</td>
                  </tr>
                ) : (
                  stats.byClient.map((client) => (
                    <tr key={client.id} className="border-b border-zinc-50 even:bg-zinc-50">
                      <td className="px-4 py-2.5 font-medium text-zinc-900">{client.name}</td>
                      <td className="px-4 py-2.5"><TierBadge tier={client.tier} /></td>
                      <td className="px-4 py-2.5 text-zinc-600">{client.subscription_count}</td>
                      <td className="px-4 py-2.5 text-zinc-600">
                        {client.total_impressions.toLocaleString()}
                        {client.total_limit > 0 && (
                          <span className="text-zinc-400"> / {client.total_limit.toLocaleString()}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Assets */}
        <div>
          <h2 className="text-lg font-bold text-zinc-900 mb-3">Top Assets by Assignment</h2>
          <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Asset</th>
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Category</th>
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Products</th>
                </tr>
              </thead>
              <tbody>
                {stats.topAssets.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-zinc-400 text-sm">No asset assignments yet</td>
                  </tr>
                ) : (
                  stats.topAssets.map((asset) => (
                    <tr key={asset.id} className="border-b border-zinc-50 even:bg-zinc-50">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded overflow-hidden bg-zinc-100 shrink-0">
                            {asset.thumbnail_url ? (
                              <img src={asset.thumbnail_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-300 text-[10px]">—</div>
                            )}
                          </div>
                          <span className="font-mono text-xs text-zinc-600 truncate">
                            {asset.upc || asset.manufacturer_sku || asset.id.slice(0, 8)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-zinc-500 text-xs truncate max-w-[150px]">
                        {asset.category_path || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-900 font-medium">{asset.assignment_count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
