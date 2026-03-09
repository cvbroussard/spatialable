'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getSubscriptions,
  getSubscription,
  toggleSubscriptionActive,
  updateSubscriptionTier,
  updateDomainWhitelist,
} from './actions';

interface SubRow {
  id: string;
  client_id: string;
  client_name: string | null;
  token_prefix: string;
  tier: string;
  domain_whitelist: string[];
  is_active: boolean;
  impression_limit: number | null;
  impressions_used: number;
  billing_period_start: string;
  created_at: string;
  expires_at: string | null;
}

interface SubDetail extends SubRow {
  style_profile_id: number | null;
  updated_at: string;
  stores: Array<{
    id: number;
    shop_domain: string;
    status: string;
    product_count: number;
    matched_count: number;
  }>;
}

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
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

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
      active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'
    }`}>
      {active ? 'active' : 'inactive'}
    </span>
  );
}

export function SubscriptionsClient() {
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [selected, setSelected] = useState<SubDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editDomains, setEditDomains] = useState('');
  const [editingDomains, setEditingDomains] = useState(false);

  const perPage = 30;

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getSubscriptions({
      tier: tierFilter || undefined,
      is_active: activeFilter || undefined,
      page,
      per_page: perPage,
    });
    setSubs(result.subscriptions as SubRow[]);
    setTotal(result.total);
    setLoading(false);
  }, [tierFilter, activeFilter, page]);

  useEffect(() => { load(); }, [load]);

  const selectSub = async (id: string) => {
    setDetailLoading(true);
    setEditingDomains(false);
    const detail = await getSubscription(id);
    setSelected(detail as SubDetail);
    setDetailLoading(false);
  };

  const handleToggleActive = async () => {
    if (!selected) return;
    await toggleSubscriptionActive(selected.id, !selected.is_active);
    await load();
    const detail = await getSubscription(selected.id);
    setSelected(detail as SubDetail);
  };

  const handleTierChange = async (tier: string) => {
    if (!selected) return;
    await updateSubscriptionTier(selected.id, tier);
    await load();
    const detail = await getSubscription(selected.id);
    setSelected(detail as SubDetail);
  };

  const handleSaveDomains = async () => {
    if (!selected) return;
    const domains = editDomains.split('\n').map((d) => d.trim()).filter(Boolean);
    await updateDomainWhitelist(selected.id, domains);
    setEditingDomains(false);
    await load();
    const detail = await getSubscription(selected.id);
    setSelected(detail as SubDetail);
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {/* Left — list */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-zinc-900">Subscriptions</h1>
          <p className="text-sm text-zinc-500 mt-1">{total} subscription{total !== 1 ? 's' : ''}</p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <select
            value={tierFilter}
            onChange={(e) => { setTierFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs bg-white"
          >
            <option value="">All tiers</option>
            {['base', 'standard', 'premium'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={activeFilter}
            onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs bg-white"
          >
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          {(tierFilter || activeFilter) && (
            <button onClick={() => { setTierFilter(''); setActiveFilter(''); setPage(1); }} className="text-xs text-zinc-500 hover:text-zinc-700 underline">
              Clear
            </button>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-zinc-400 text-sm">Loading subscriptions...</div>
          ) : subs.length === 0 ? (
            <div className="text-zinc-400 text-sm">No subscriptions match these filters.</div>
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Token</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Client</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Tier</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Impressions</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Domains</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((sub) => (
                    <tr
                      key={sub.id}
                      onClick={() => selectSub(sub.id)}
                      className={`border-b border-zinc-50 cursor-pointer transition-colors ${
                        selected?.id === sub.id ? 'bg-zinc-100' : 'even:bg-zinc-50 hover:bg-zinc-50'
                      }`}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-zinc-600">{sub.token_prefix}...</td>
                      <td className="px-4 py-2.5 text-zinc-700">{sub.client_name || '—'}</td>
                      <td className="px-4 py-2.5"><TierBadge tier={sub.tier} /></td>
                      <td className="px-4 py-2.5"><ActiveBadge active={sub.is_active} /></td>
                      <td className="px-4 py-2.5 text-zinc-600">
                        {sub.impressions_used.toLocaleString()}
                        {sub.impression_limit != null && <span className="text-zinc-400"> / {sub.impression_limit.toLocaleString()}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-500">{sub.domain_whitelist.length}</td>
                      <td className="px-4 py-2.5 text-zinc-500">
                        {sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-100">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-30"
            >
              Prev
            </button>
            <span className="text-xs text-zinc-500">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-30"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Right — detail */}
      <div className="w-[420px] shrink-0 rounded-xl border border-zinc-200 bg-white overflow-y-auto">
        {detailLoading ? (
          <div className="p-6 text-zinc-400 text-sm">Loading...</div>
        ) : selected ? (
          <div className="p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center gap-2">
              <TierBadge tier={selected.tier} />
              <ActiveBadge active={selected.is_active} />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleToggleActive}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  selected.is_active
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {selected.is_active ? 'Deactivate' : 'Activate'}
              </button>
              <select
                value={selected.tier}
                onChange={(e) => handleTierChange(e.target.value)}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs bg-white"
              >
                {['base', 'standard', 'premium'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Fields */}
            <div className="space-y-3 text-sm">
              <Field label="Subscription ID" value={selected.id} mono />
              <Field label="Client" value={selected.client_name || selected.client_id} />
              <Field label="Token Prefix" value={selected.token_prefix} mono />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-0.5">Impressions</div>
                <div className="text-zinc-700">
                  {selected.impressions_used.toLocaleString()}
                  {selected.impression_limit != null && (
                    <span className="text-zinc-400"> / {selected.impression_limit.toLocaleString()}</span>
                  )}
                </div>
                {selected.impression_limit != null && (
                  <div className="mt-1.5 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-zinc-900"
                      style={{ width: `${Math.min(100, (selected.impressions_used / selected.impression_limit) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
              <Field label="Billing Period Start" value={new Date(selected.billing_period_start).toLocaleDateString()} />
              {selected.expires_at && (
                <Field label="Expires" value={new Date(selected.expires_at).toLocaleDateString()} />
              )}
              <Field label="Created" value={new Date(selected.created_at).toLocaleString()} />
            </div>

            {/* Domain Whitelist */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
                  Domain Whitelist ({selected.domain_whitelist.length})
                </div>
                <button
                  onClick={() => {
                    setEditDomains(selected.domain_whitelist.join('\n'));
                    setEditingDomains(!editingDomains);
                  }}
                  className="text-xs text-zinc-500 hover:text-zinc-700 underline"
                >
                  {editingDomains ? 'Cancel' : 'Edit'}
                </button>
              </div>
              {editingDomains ? (
                <div className="space-y-2">
                  <textarea
                    value={editDomains}
                    onChange={(e) => setEditDomains(e.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs font-mono"
                    placeholder="One domain per line"
                  />
                  <button
                    onClick={handleSaveDomains}
                    className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
                  >
                    Save
                  </button>
                </div>
              ) : selected.domain_whitelist.length > 0 ? (
                <div className="space-y-1">
                  {selected.domain_whitelist.map((d) => (
                    <div key={d} className="text-xs font-mono text-zinc-600">{d}</div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-zinc-400">No domain restrictions</div>
              )}
            </div>

            {/* Linked Stores */}
            {selected.stores.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-2">
                  Linked Stores ({selected.stores.length})
                </div>
                <div className="space-y-1.5">
                  {selected.stores.map((store) => (
                    <div key={store.id} className="flex items-center justify-between text-xs">
                      <span className="font-mono text-zinc-700">{store.shop_domain}</span>
                      <span className="text-zinc-400">
                        {store.matched_count}/{store.product_count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-zinc-400 text-sm">Select a subscription to view details.</div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-0.5">{label}</div>
      <div className={`text-zinc-700 ${mono ? 'font-mono text-xs' : ''}`}>{value}</div>
    </div>
  );
}
