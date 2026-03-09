'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAssets, getAsset, updateAssetStatus, getFilterOptions } from './actions';

interface AssetRow {
  id: string;
  specificity: string;
  status: string;
  upc: string | null;
  manufacturer_sku: string | null;
  form_factor_id: number | null;
  glb_url: string | null;
  thumbnail_url: string | null;
  vertex_count: number | null;
  file_size_bytes: number | null;
  source_images: string[];
  category_path: string | null;
  attributes: Record<string, any>;
  tags: string[];
  created_at: string;
  updated_at: string;
  product_count: number;
}

interface AssetDetail extends AssetRow {
  product_assets: Array<{ product_ref: string; role: string; position: number }>;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    approved: 'bg-green-100 text-green-700',
    review: 'bg-blue-100 text-blue-700',
    generating: 'bg-purple-100 text-purple-700',
    rejected: 'bg-red-100 text-red-700',
    archived: 'bg-zinc-200 text-zinc-500',
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${colors[status] || 'bg-zinc-100 text-zinc-600'}`}>
      {status}
    </span>
  );
}

function SpecBadge({ specificity }: { specificity: string }) {
  const colors: Record<string, string> = {
    upc: 'bg-emerald-100 text-emerald-700',
    sku: 'bg-sky-100 text-sky-700',
    form_factor: 'bg-amber-100 text-amber-700',
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${colors[specificity] || 'bg-zinc-100 text-zinc-600'}`}>
      {specificity}
    </span>
  );
}

export function AssetsClient() {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AssetDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [specFilter, setSpecFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const perPage = 40;

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getAssets({
      status: statusFilter || undefined,
      specificity: specFilter || undefined,
      category: categoryFilter || undefined,
      page,
      per_page: perPage,
    });
    setAssets(result.assets as AssetRow[]);
    setTotal(result.total);
    setLoading(false);
  }, [statusFilter, specFilter, categoryFilter, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    getFilterOptions().then((opts) => setCategories(opts.categories));
  }, []);

  const selectAsset = async (id: string) => {
    setDetailLoading(true);
    const detail = await getAsset(id);
    setSelected(detail as AssetDetail);
    setDetailLoading(false);
  };

  const handleStatusChange = async (id: string, status: string) => {
    await updateAssetStatus(id, status);
    await load();
    if (selected?.id === id) {
      const detail = await getAsset(id);
      setSelected(detail as AssetDetail);
    }
  };

  const resetFilters = () => {
    setStatusFilter('');
    setSpecFilter('');
    setCategoryFilter('');
    setPage(1);
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {/* Left panel — grid */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-zinc-900">Assets</h1>
          <p className="text-sm text-zinc-500 mt-1">{total} asset{total !== 1 ? 's' : ''}</p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs bg-white"
          >
            <option value="">All statuses</option>
            {['generating', 'review', 'approved', 'rejected', 'archived'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={specFilter}
            onChange={(e) => { setSpecFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs bg-white"
          >
            <option value="">All specificities</option>
            {['upc', 'sku', 'form_factor'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs bg-white"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {(statusFilter || specFilter || categoryFilter) && (
            <button onClick={resetFilters} className="text-xs text-zinc-500 hover:text-zinc-700 underline">
              Clear
            </button>
          )}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-zinc-400 text-sm">Loading assets...</div>
          ) : assets.length === 0 ? (
            <div className="text-zinc-400 text-sm">No assets match these filters.</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => selectAsset(asset.id)}
                  className={`group rounded-xl border bg-white overflow-hidden text-left transition-all ${
                    selected?.id === asset.id
                      ? 'border-zinc-900 ring-1 ring-zinc-900'
                      : 'border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  <div className="aspect-square bg-zinc-100 relative">
                    {asset.thumbnail_url ? (
                      <img
                        src={asset.thumbnail_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-300 text-xs">
                        No image
                      </div>
                    )}
                    <div className="absolute top-1.5 left-1.5">
                      <StatusBadge status={asset.status} />
                    </div>
                  </div>
                  <div className="px-2.5 py-2 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <SpecBadge specificity={asset.specificity} />
                      {asset.product_count > 0 && (
                        <span className="text-[10px] text-zinc-400">{asset.product_count} prod</span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-500 truncate">
                      {asset.upc || asset.manufacturer_sku || asset.category_path || asset.id.slice(0, 8)}
                    </div>
                  </div>
                </button>
              ))}
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

      {/* Right panel — detail */}
      <div className="w-[420px] shrink-0 rounded-xl border border-zinc-200 bg-white overflow-y-auto">
        {detailLoading ? (
          <div className="p-6 text-zinc-400 text-sm">Loading...</div>
        ) : selected ? (
          <div className="p-6 space-y-5">
            {/* Preview */}
            {selected.thumbnail_url && (
              <div className="rounded-lg overflow-hidden bg-zinc-100">
                <img src={selected.thumbnail_url} alt="" className="w-full" />
              </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-2">
              <StatusBadge status={selected.status} />
              <SpecBadge specificity={selected.specificity} />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {selected.status !== 'approved' && (
                <button
                  onClick={() => handleStatusChange(selected.id, 'approved')}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                >
                  Approve
                </button>
              )}
              {selected.status !== 'rejected' && (
                <button
                  onClick={() => handleStatusChange(selected.id, 'rejected')}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                >
                  Reject
                </button>
              )}
              {selected.status !== 'archived' && selected.status !== 'generating' && (
                <button
                  onClick={() => handleStatusChange(selected.id, 'archived')}
                  className="rounded-lg bg-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-300"
                >
                  Archive
                </button>
              )}
            </div>

            {/* Fields */}
            <div className="space-y-3 text-sm">
              <Field label="ID" value={selected.id} mono />
              {selected.upc && <Field label="UPC" value={selected.upc} />}
              {selected.manufacturer_sku && <Field label="SKU" value={selected.manufacturer_sku} />}
              {selected.category_path && <Field label="Category" value={selected.category_path} />}
              {selected.glb_url && <Field label="GLB" value={selected.glb_url} mono truncate />}
              {selected.vertex_count != null && (
                <Field label="Vertices" value={selected.vertex_count.toLocaleString()} />
              )}
              {selected.file_size_bytes != null && (
                <Field label="File Size" value={formatBytes(selected.file_size_bytes)} />
              )}
              {selected.tags.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-1">Tags</div>
                  <div className="flex flex-wrap gap-1">
                    {selected.tags.map((t) => (
                      <span key={t} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              <Field label="Created" value={new Date(selected.created_at).toLocaleString()} />
              <Field label="Updated" value={new Date(selected.updated_at).toLocaleString()} />
            </div>

            {/* Source Images */}
            {selected.source_images.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-2">
                  Source Images ({selected.source_images.length})
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {selected.source_images.map((url, i) => (
                    <div key={i} className="aspect-square rounded-lg overflow-hidden bg-zinc-100">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Product Assignments */}
            {selected.product_assets.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-2">
                  Product Assignments ({selected.product_assets.length})
                </div>
                <div className="space-y-1">
                  {selected.product_assets.map((pa, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-zinc-500">{pa.product_ref}</span>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600">{pa.role}</span>
                      <span className="text-zinc-400">pos {pa.position}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-zinc-400 text-sm">Select an asset to view details.</div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, mono, truncate: trunc }: { label: string; value: string; mono?: boolean; truncate?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-0.5">{label}</div>
      <div className={`text-zinc-700 ${mono ? 'font-mono text-xs' : ''} ${trunc ? 'truncate' : ''}`}>{value}</div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
