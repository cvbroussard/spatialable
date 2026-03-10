'use client';

import { useState, useEffect, useCallback } from 'react';
import { getJobs, getJob, retryJob, getPipelineStats } from './actions';

interface JobRow {
  id: string;
  client_id: string;
  client_name: string | null;
  status: string;
  source_images: string[];
  source_count: number;
  product_metadata: Record<string, any>;
  meshy_task_id: string | null;
  error: string | null;
  attempts: number;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface JobDetail extends JobRow {
  raw_mesh_url: string | null;
  identified_materials: any[] | null;
  matched_material_ids: number[] | null;
  final_asset_id: string | null;
  linked_source_images: Array<{
    id: number;
    image_url: string;
    product_name: string | null;
    curation_status: string;
  }>;
}

interface StatusCount {
  status: string;
  count: number;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    queued: 'bg-yellow-100 text-yellow-700',
    meshy_submitted: 'bg-purple-100 text-purple-700',
    mesh_ready: 'bg-blue-100 text-blue-700',
    material_matching: 'bg-indigo-100 text-indigo-700',
    materials_matched: 'bg-sky-100 text-sky-700',
    blender_processing: 'bg-orange-100 text-orange-700',
    post_processing: 'bg-amber-100 text-amber-700',
    review: 'bg-blue-100 text-blue-700',
    complete: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${colors[status] || 'bg-zinc-100 text-zinc-600'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

const ALL_STATUSES = [
  'queued', 'meshy_submitted', 'mesh_ready', 'material_matching',
  'materials_matched', 'blender_processing', 'post_processing',
  'review', 'complete', 'failed',
];

export function PipelineClient() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [stats, setStats] = useState<StatusCount[]>([]);
  const [selected, setSelected] = useState<JobDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const perPage = 30;

  const load = useCallback(async () => {
    setLoading(true);
    const [result, pipelineStats] = await Promise.all([
      getJobs({ status: statusFilter || undefined, page, per_page: perPage }),
      getPipelineStats(),
    ]);
    setJobs(result.jobs as JobRow[]);
    setTotal(result.total);
    setStats(pipelineStats as StatusCount[]);
    setLoading(false);
  }, [statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  const selectJob = async (id: string) => {
    setDetailLoading(true);
    const detail = await getJob(id);
    setSelected(detail as JobDetail);
    setDetailLoading(false);
  };

  const handleRetry = async (id: string) => {
    await retryJob(id);
    await load();
    if (selected?.id === id) {
      const detail = await getJob(id);
      setSelected(detail as JobDetail);
    }
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {/* Left — job list */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-zinc-900">Pipeline</h1>
          <p className="text-sm text-zinc-500 mt-1">{total} generation job{total !== 1 ? 's' : ''}</p>
        </div>

        {/* Status summary pills */}
        {stats.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {stats.map((s) => (
              <button
                key={s.status}
                onClick={() => { setStatusFilter(s.status === statusFilter ? '' : s.status); setPage(1); }}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors ${
                  s.status === statusFilter ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                <StatusBadge status={s.status} />
                <span className="font-medium">{s.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs bg-white"
          >
            <option value="">All statuses</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
          {statusFilter && (
            <button onClick={() => { setStatusFilter(''); setPage(1); }} className="text-xs text-zinc-500 hover:text-zinc-700 underline">
              Clear
            </button>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-zinc-400 text-sm">Loading jobs...</div>
          ) : jobs.length === 0 ? (
            <div className="text-zinc-400 text-sm">No jobs match these filters.</div>
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Job ID</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Product</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Client</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Sources</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr
                      key={job.id}
                      onClick={() => selectJob(job.id)}
                      className={`border-b border-zinc-50 cursor-pointer transition-colors ${
                        selected?.id === job.id ? 'bg-zinc-100' : 'even:bg-zinc-50 hover:bg-zinc-50'
                      }`}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-zinc-500">{job.id.slice(0, 8)}...</td>
                      <td className="px-4 py-2.5 text-zinc-700">{job.product_metadata?.name || '—'}</td>
                      <td className="px-4 py-2.5 text-zinc-600">{job.client_name || '—'}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={job.status} /></td>
                      <td className="px-4 py-2.5 text-zinc-600">{job.source_count}</td>
                      <td className="px-4 py-2.5 text-zinc-500">{new Date(job.created_at).toLocaleDateString()}</td>
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

      {/* Right — detail panel */}
      <div className="w-[440px] shrink-0 rounded-xl border border-zinc-200 bg-white overflow-y-auto">
        {detailLoading ? (
          <div className="p-6 text-zinc-400 text-sm">Loading...</div>
        ) : selected ? (
          <div className="p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center gap-2">
              <StatusBadge status={selected.status} />
              <span className="text-xs text-zinc-400">Attempt {selected.attempts}</span>
            </div>

            {/* Retry */}
            {selected.status === 'failed' && (
              <button
                onClick={() => handleRetry(selected.id)}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
              >
                Retry Job
              </button>
            )}

            {/* Error */}
            {selected.error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                <div className="text-[10px] uppercase tracking-wider text-red-400 font-semibold mb-1">Error</div>
                <div className="text-xs text-red-700 font-mono whitespace-pre-wrap">{selected.error}</div>
              </div>
            )}

            {/* Fields */}
            <div className="space-y-3 text-sm">
              <Field label="Job ID" value={selected.id} mono />
              <Field label="Client" value={selected.client_name || selected.client_id} />
              {selected.product_metadata?.name && (
                <Field label="Product" value={selected.product_metadata.name} />
              )}
              {selected.product_metadata?.upc && (
                <Field label="GTIN / UPC" value={selected.product_metadata.upc} />
              )}
              {selected.product_metadata?.category && (
                <Field label="Category" value={selected.product_metadata.category} />
              )}
              {selected.meshy_task_id && (
                <Field label="Meshy Task" value={selected.meshy_task_id} mono />
              )}
              {selected.raw_mesh_url && (
                <Field label="Raw Mesh" value={selected.raw_mesh_url} mono truncate />
              )}
              {selected.final_asset_id && (
                <Field label="Final Asset" value={selected.final_asset_id} mono />
              )}
              <Field label="Created" value={new Date(selected.created_at).toLocaleString()} />
              {selected.started_at && (
                <Field label="Started" value={new Date(selected.started_at).toLocaleString()} />
              )}
              {selected.completed_at && (
                <Field label="Completed" value={new Date(selected.completed_at).toLocaleString()} />
              )}
            </div>

            {/* Identified Materials */}
            {selected.identified_materials && selected.identified_materials.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-2">
                  Identified Materials ({selected.identified_materials.length})
                </div>
                <div className="space-y-1">
                  {selected.identified_materials.map((m: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-zinc-700">{m.region}</span>
                      <span className="text-zinc-500">{m.material_type}</span>
                      {m.color && <span className="text-zinc-400">{m.color}</span>}
                      <span className="text-zinc-400">{(m.confidence * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Matched Material IDs */}
            {selected.matched_material_ids && selected.matched_material_ids.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-1">
                  Matched Materials
                </div>
                <div className="text-xs text-zinc-600 font-mono">
                  [{selected.matched_material_ids.join(', ')}]
                </div>
              </div>
            )}

            {/* Source Images (from job JSON) */}
            {selected.source_images.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-2">
                  Source Images ({selected.source_images.length})
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {selected.source_images.map((url: string, i: number) => (
                    <div key={i} className="aspect-square rounded-lg overflow-hidden bg-zinc-100">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Linked Source Image records */}
            {selected.linked_source_images.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-2">
                  Linked Source Records ({selected.linked_source_images.length})
                </div>
                <div className="space-y-1.5">
                  {selected.linked_source_images.map((si) => (
                    <div key={si.id} className="flex items-center gap-2 text-xs">
                      <div className="w-8 h-8 rounded overflow-hidden bg-zinc-100 shrink-0">
                        <img src={si.image_url} alt="" className="w-full h-full object-cover" />
                      </div>
                      <span className="text-zinc-700 truncate flex-1">{si.product_name || `#${si.id}`}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                        si.curation_status === 'queued' ? 'bg-yellow-100 text-yellow-700' : 'bg-zinc-100 text-zinc-500'
                      }`}>
                        {si.curation_status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-zinc-400 text-sm">Select a job to view details.</div>
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
