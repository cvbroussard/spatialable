'use client';

import { useState, useEffect, useCallback } from 'react';
import { getMaterials, getMaterial, getFilterOptions } from './actions';

interface MaterialRow {
  id: number;
  name: string;
  material_type: string;
  source: string;
  preview_url: string | null;
  tags: string[];
  created_at: string;
}

interface MaterialDetail extends MaterialRow {
  external_id: string | null;
  albedo_url: string | null;
  normal_url: string | null;
  roughness_url: string | null;
  metallic_url: string | null;
  ao_url: string | null;
  updated_at: string;
  asset_count: number;
}

function SourceBadge({ source }: { source: string }) {
  const colors: Record<string, string> = {
    poly_haven: 'bg-emerald-100 text-emerald-700',
    ambientcg: 'bg-sky-100 text-sky-700',
    manufacturer: 'bg-amber-100 text-amber-700',
    scanned: 'bg-purple-100 text-purple-700',
    custom: 'bg-zinc-100 text-zinc-600',
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${colors[source] || 'bg-zinc-100 text-zinc-600'}`}>
      {source.replace(/_/g, ' ')}
    </span>
  );
}

export function MaterialsClient() {
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MaterialDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [typeFilter, setTypeFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [types, setTypes] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);

  const perPage = 40;

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getMaterials({
      material_type: typeFilter || undefined,
      source: sourceFilter || undefined,
      tag: tagFilter || undefined,
      page,
      per_page: perPage,
    });
    setMaterials(result.materials as MaterialRow[]);
    setTotal(result.total);
    setLoading(false);
  }, [typeFilter, sourceFilter, tagFilter, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    getFilterOptions().then((opts) => {
      setTypes(opts.types);
      setSources(opts.sources);
      setAllTags(opts.tags);
    });
  }, []);

  const selectMaterial = async (id: number) => {
    setDetailLoading(true);
    const detail = await getMaterial(id);
    setSelected(detail as MaterialDetail);
    setDetailLoading(false);
  };

  const resetFilters = () => {
    setTypeFilter('');
    setSourceFilter('');
    setTagFilter('');
    setPage(1);
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {/* Left — grid */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-zinc-900">Materials</h1>
          <p className="text-sm text-zinc-500 mt-1">{total} PBR material{total !== 1 ? 's' : ''}</p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs bg-white"
          >
            <option value="">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={sourceFilter}
            onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs bg-white"
          >
            <option value="">All sources</option>
            {sources.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <select
            value={tagFilter}
            onChange={(e) => { setTagFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs bg-white"
          >
            <option value="">All tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {(typeFilter || sourceFilter || tagFilter) && (
            <button onClick={resetFilters} className="text-xs text-zinc-500 hover:text-zinc-700 underline">
              Clear
            </button>
          )}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-zinc-400 text-sm">Loading materials...</div>
          ) : materials.length === 0 ? (
            <div className="text-zinc-400 text-sm">No materials match these filters.</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              {materials.map((mat) => (
                <button
                  key={mat.id}
                  onClick={() => selectMaterial(mat.id)}
                  className={`group rounded-xl border bg-white overflow-hidden text-left transition-all ${
                    selected?.id === mat.id
                      ? 'border-zinc-900 ring-1 ring-zinc-900'
                      : 'border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  <div className="aspect-square bg-zinc-100 relative">
                    {mat.preview_url ? (
                      <img src={mat.preview_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-300 text-xs">
                        No preview
                      </div>
                    )}
                    <div className="absolute top-1.5 left-1.5">
                      <SourceBadge source={mat.source} />
                    </div>
                  </div>
                  <div className="px-2.5 py-2 space-y-0.5">
                    <div className="text-xs font-medium text-zinc-900 truncate">{mat.name}</div>
                    <div className="text-[11px] text-zinc-500 truncate">{mat.material_type}</div>
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

      {/* Right — detail */}
      <div className="w-[420px] shrink-0 rounded-xl border border-zinc-200 bg-white overflow-y-auto">
        {detailLoading ? (
          <div className="p-6 text-zinc-400 text-sm">Loading...</div>
        ) : selected ? (
          <div className="p-6 space-y-5">
            {/* Preview */}
            {selected.preview_url && (
              <div className="rounded-lg overflow-hidden bg-zinc-100">
                <img src={selected.preview_url} alt="" className="w-full" />
              </div>
            )}

            {/* Header */}
            <div>
              <div className="text-sm font-medium text-zinc-900">{selected.name}</div>
              <div className="flex items-center gap-2 mt-1">
                <SourceBadge source={selected.source} />
                <span className="text-xs text-zinc-500">{selected.material_type}</span>
              </div>
            </div>

            {/* Fields */}
            <div className="space-y-3 text-sm">
              <Field label="ID" value={String(selected.id)} />
              {selected.external_id && <Field label="External ID" value={selected.external_id} mono />}
              <Field label="Used in Assets" value={`${selected.asset_count} asset${selected.asset_count !== 1 ? 's' : ''}`} />
              <Field label="Created" value={new Date(selected.created_at).toLocaleString()} />
              <Field label="Updated" value={new Date(selected.updated_at).toLocaleString()} />
            </div>

            {/* PBR Maps */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-2">PBR Maps</div>
              <div className="space-y-2">
                {[
                  { label: 'Albedo', url: selected.albedo_url },
                  { label: 'Normal', url: selected.normal_url },
                  { label: 'Roughness', url: selected.roughness_url },
                  { label: 'Metallic', url: selected.metallic_url },
                  { label: 'AO', url: selected.ao_url },
                ].map(({ label, url }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded overflow-hidden bg-zinc-100 shrink-0">
                      {url ? (
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-300 text-[10px]">—</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-zinc-700">{label}</div>
                      {url ? (
                        <div className="text-[11px] text-zinc-400 font-mono truncate">{url}</div>
                      ) : (
                        <div className="text-[11px] text-zinc-300">Not set</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tags */}
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
          </div>
        ) : (
          <div className="p-6 text-zinc-400 text-sm">Select a material to view details.</div>
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
