'use client';

import { useState, useEffect, useCallback } from 'react';
import { getStores, getStoreDetail, getRecentSyncLog } from './actions';

interface StoreRow {
  id: number;
  shop_domain: string;
  client_name: string | null;
  status: string;
  product_count: number;
  matched_count: number;
  hit_rate: number;
  last_sync_at: string | null;
  created_at: string;
}

interface MatchBreakdown {
  match_type: string;
  count: number;
  avg_confidence: number;
  metafields_written: number;
}

interface TypeBreakdown {
  product_type: string;
  total: number;
  matched: number;
  hit_rate: number;
}

interface GapProduct {
  title: string;
  vendor: string | null;
  product_type: string | null;
  image_url: string | null;
}

interface SyncLogEntry {
  id: number;
  shopify_product_id: number;
  action: string;
  synced_at: string;
}

interface StoreDetail extends StoreRow {
  client_id: string;
  subscription_token: string | null;
  matchBreakdown: MatchBreakdown[];
  typeBreakdown: TypeBreakdown[];
  gapProducts: GapProduct[];
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    paused: 'bg-zinc-200 text-zinc-500',
    disconnected: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${colors[status] || 'bg-zinc-100 text-zinc-600'}`}>
      {status}
    </span>
  );
}

function MatchTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    upc: 'bg-emerald-100 text-emerald-700',
    sku: 'bg-sky-100 text-sky-700',
    vendor_type: 'bg-amber-100 text-amber-700',
    form_factor: 'bg-orange-100 text-orange-700',
    none: 'bg-zinc-100 text-zinc-500',
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${colors[type] || 'bg-zinc-100 text-zinc-600'}`}>
      {type.replace(/_/g, ' ')}
    </span>
  );
}

function HitRateBar({ rate }: { rate: number }) {
  const color = rate >= 70 ? 'bg-green-500' : rate >= 40 ? 'bg-amber-500' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, rate)}%` }} />
      </div>
      <span className="text-xs text-zinc-600 font-medium">{rate}%</span>
    </div>
  );
}

export function StoresClient() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<StoreDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [showTab, setShowTab] = useState<'breakdown' | 'gaps' | 'log'>('breakdown');

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getStores();
    setStores(result as StoreRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectStore = async (id: number) => {
    setDetailLoading(true);
    setShowTab('breakdown');
    const [detail, log] = await Promise.all([
      getStoreDetail(id),
      getRecentSyncLog(id),
    ]);
    setSelected(detail as StoreDetail);
    setSyncLog(log as SyncLogEntry[]);
    setDetailLoading(false);
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {/* Left — store list */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-zinc-900">Shopify Stores</h1>
          <p className="text-sm text-zinc-500 mt-1">{stores.length} store{stores.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-zinc-400 text-sm">Loading stores...</div>
          ) : stores.length === 0 ? (
            <div className="text-zinc-400 text-sm">No Shopify stores connected yet.</div>
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Domain</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Client</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Products</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Hit Rate</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Last Sync</th>
                  </tr>
                </thead>
                <tbody>
                  {stores.map((store) => (
                    <tr
                      key={store.id}
                      onClick={() => selectStore(store.id)}
                      className={`border-b border-zinc-50 cursor-pointer transition-colors ${
                        selected?.id === store.id ? 'bg-zinc-100' : 'even:bg-zinc-50 hover:bg-zinc-50'
                      }`}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-zinc-700">{store.shop_domain}</td>
                      <td className="px-4 py-2.5 text-zinc-600">{store.client_name || '—'}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={store.status} /></td>
                      <td className="px-4 py-2.5 text-zinc-600">
                        {store.matched_count}/{store.product_count}
                      </td>
                      <td className="px-4 py-2.5">
                        <HitRateBar rate={store.hit_rate} />
                      </td>
                      <td className="px-4 py-2.5 text-zinc-500">
                        {store.last_sync_at ? new Date(store.last_sync_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Right — detail + hit rate report */}
      <div className="w-[460px] shrink-0 rounded-xl border border-zinc-200 bg-white overflow-y-auto">
        {detailLoading ? (
          <div className="p-6 text-zinc-400 text-sm">Loading...</div>
        ) : selected ? (
          <div className="p-6 space-y-5">
            {/* Header */}
            <div>
              <div className="font-mono text-sm text-zinc-900 font-medium">{selected.shop_domain}</div>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={selected.status} />
                <span className="text-xs text-zinc-500">{selected.client_name}</span>
              </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-zinc-200 p-3 text-center">
                <div className="text-lg font-bold text-zinc-900">{selected.product_count}</div>
                <div className="text-[10px] text-zinc-400 uppercase">Products</div>
              </div>
              <div className="rounded-lg border border-zinc-200 p-3 text-center">
                <div className="text-lg font-bold text-zinc-900">{selected.matched_count}</div>
                <div className="text-[10px] text-zinc-400 uppercase">Matched</div>
              </div>
              <div className="rounded-lg border border-zinc-200 p-3 text-center">
                <div className="text-lg font-bold text-zinc-900">{selected.hit_rate}%</div>
                <div className="text-[10px] text-zinc-400 uppercase">Hit Rate</div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-zinc-200">
              {(['breakdown', 'gaps', 'log'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setShowTab(tab)}
                  className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                    showTab === tab
                      ? 'border-zinc-900 text-zinc-900'
                      : 'border-transparent text-zinc-400 hover:text-zinc-600'
                  }`}
                >
                  {tab === 'breakdown' ? 'Match Breakdown' : tab === 'gaps' ? 'Gap Products' : 'Sync Log'}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {showTab === 'breakdown' && (
              <div className="space-y-4">
                {/* By match type */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-2">By Match Type</div>
                  {selected.matchBreakdown.length === 0 ? (
                    <div className="text-xs text-zinc-400">No matches yet.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {selected.matchBreakdown.map((m) => (
                        <div key={m.match_type} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <MatchTypeBadge type={m.match_type} />
                            <span className="text-zinc-600">{m.count} products</span>
                          </div>
                          <div className="flex items-center gap-2 text-zinc-400">
                            <span>{m.avg_confidence} conf</span>
                            <span>{m.metafields_written} written</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* By product type */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-2">By Product Type</div>
                  {selected.typeBreakdown.length === 0 ? (
                    <div className="text-xs text-zinc-400">No products yet.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {selected.typeBreakdown.map((t) => (
                        <div key={t.product_type} className="flex items-center justify-between text-xs">
                          <span className="text-zinc-700 truncate max-w-[180px]">{t.product_type}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-500">{t.matched}/{t.total}</span>
                            <HitRateBar rate={t.hit_rate} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {showTab === 'gaps' && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-2">
                  Unmatched Products (top 20)
                </div>
                {selected.gapProducts.length === 0 ? (
                  <div className="text-xs text-zinc-400">All products matched!</div>
                ) : (
                  <div className="space-y-2">
                    {selected.gapProducts.map((p, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs">
                        <div className="w-8 h-8 rounded overflow-hidden bg-zinc-100 shrink-0">
                          {p.image_url ? (
                            <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-300 text-[10px]">—</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-zinc-700 truncate">{p.title}</div>
                          <div className="text-zinc-400 truncate">
                            {[p.vendor, p.product_type].filter(Boolean).join(' · ') || '—'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {showTab === 'log' && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-2">
                  Recent Sync Events
                </div>
                {syncLog.length === 0 ? (
                  <div className="text-xs text-zinc-400">No sync events yet.</div>
                ) : (
                  <div className="space-y-1">
                    {syncLog.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-500 font-mono">#{entry.shopify_product_id}</span>
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                            entry.action === 'create' ? 'bg-green-100 text-green-700' :
                            entry.action === 'update' ? 'bg-blue-100 text-blue-700' :
                            entry.action === 'delete' ? 'bg-red-100 text-red-700' :
                            'bg-zinc-100 text-zinc-600'
                          }`}>
                            {entry.action}
                          </span>
                        </div>
                        <span className="text-zinc-400">{new Date(entry.synced_at).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-zinc-400 text-sm">Select a store to view hit rate report.</div>
        )}
      </div>
    </div>
  );
}
