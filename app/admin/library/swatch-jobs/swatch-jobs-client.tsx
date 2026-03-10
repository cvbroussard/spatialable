'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getSwatchJobs,
  getSwatchJob,
  createSwatchJob,
  approveSwatchJob,
  rejectSwatchJob,
  retrySwatchJob,
  getSwatchJobStatusCounts,
} from './actions';
import type { SwatchJob, SwatchJobStatus, SwatchVisionAnalysis } from '@/lib/types';

const STATUS_COLORS: Record<string, string> = {
  uploaded: 'bg-zinc-100 text-zinc-600',
  analyzing: 'bg-blue-100 text-blue-700',
  preprocessing: 'bg-blue-100 text-blue-700',
  deriving: 'bg-indigo-100 text-indigo-700',
  review: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  failed: 'bg-red-100 text-red-700',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[status] || 'bg-zinc-100 text-zinc-600'}`}>
      {status}
    </span>
  );
}

export function SwatchJobsClient() {
  const [jobs, setJobs] = useState<SwatchJob[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SwatchJob | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [statusCounts, setStatusCounts] = useState<{ status: string; count: number }[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);

  const perPage = 30;

  const load = useCallback(async () => {
    setLoading(true);
    const [result, counts] = await Promise.all([
      getSwatchJobs({
        status: (statusFilter || undefined) as SwatchJobStatus | undefined,
        page,
        per_page: perPage,
      }),
      getSwatchJobStatusCounts(),
    ]);
    setJobs(result.jobs);
    setTotal(result.total);
    setStatusCounts(counts);
    setLoading(false);
  }, [statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  const selectJob = async (id: string) => {
    setDetailLoading(true);
    const job = await getSwatchJob(id);
    setSelected(job);
    setDetailLoading(false);
  };

  const handleApprove = async () => {
    if (!selected) return;
    await approveSwatchJob(selected.id);
    await selectJob(selected.id);
    load();
  };

  const handleReject = async () => {
    if (!selected) return;
    await rejectSwatchJob(selected.id);
    await selectJob(selected.id);
    load();
  };

  const handleRetry = async () => {
    if (!selected) return;
    await retrySwatchJob(selected.id);
    await selectJob(selected.id);
    load();
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const file = formData.get('swatch') as File;
    if (!file || file.size === 0) return;

    setUploading(true);
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    await createSwatchJob({
      imageBase64: base64,
      contentType: file.type,
      manufacturer_name: (formData.get('manufacturer_name') as string) || undefined,
      manufacturer_sku: (formData.get('manufacturer_sku') as string) || undefined,
      material_name: (formData.get('material_name') as string) || undefined,
    });

    setUploading(false);
    setShowUpload(false);
    form.reset();
    load();
  };

  const totalPages = Math.ceil(total / perPage);
  const analysis = selected?.vision_analysis as SwatchVisionAnalysis | null;

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {/* Left — list */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">Swatch Jobs</h1>
            <p className="text-sm text-zinc-500 mt-1">Swatch-to-PBR material pipeline</p>
          </div>
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800"
          >
            Upload Swatch
          </button>
        </div>

        {/* Upload form */}
        {showUpload && (
          <form onSubmit={handleUpload} className="mb-4 p-4 rounded-xl border border-zinc-200 bg-white space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <input
                name="material_name"
                placeholder="Material name"
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs"
              />
              <input
                name="manufacturer_name"
                placeholder="Manufacturer"
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs"
              />
              <input
                name="manufacturer_sku"
                placeholder="SKU"
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                name="swatch"
                type="file"
                accept="image/*"
                required
                className="flex-1 text-xs text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-zinc-700 hover:file:bg-zinc-200"
              />
              <button
                type="submit"
                disabled={uploading}
                className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Start Pipeline'}
              </button>
              <button
                type="button"
                onClick={() => setShowUpload(false)}
                className="text-xs text-zinc-500 hover:text-zinc-700"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Status pills */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <button
            onClick={() => { setStatusFilter(''); setPage(1); }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              !statusFilter ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            All ({total})
          </button>
          {statusCounts.map(({ status, count }) => (
            <button
              key={status}
              onClick={() => { setStatusFilter(status); setPage(1); }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === status ? 'bg-zinc-900 text-white' : `${STATUS_COLORS[status]} hover:opacity-80`
              }`}
            >
              {status} ({count})
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto rounded-xl border border-zinc-200 bg-white">
          {loading ? (
            <div className="p-4 text-zinc-400 text-sm">Loading...</div>
          ) : jobs.length === 0 ? (
            <div className="p-4 text-zinc-400 text-sm">No swatch jobs found.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-[10px] uppercase tracking-wider text-zinc-400 border-b border-zinc-100 sticky top-0 bg-white">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Material</th>
                  <th className="px-4 py-2.5 font-semibold">Manufacturer</th>
                  <th className="px-4 py-2.5 font-semibold">Type</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr
                    key={job.id}
                    onClick={() => selectJob(job.id)}
                    className={`border-b border-zinc-50 cursor-pointer transition-colors ${
                      selected?.id === job.id ? 'bg-zinc-50' : 'hover:bg-zinc-50/50'
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded overflow-hidden bg-zinc-100 shrink-0">
                          <img src={job.swatch_image_url} alt="" className="w-full h-full object-cover" />
                        </div>
                        <span className="font-medium text-zinc-900 truncate">
                          {job.material_name || 'Untitled'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-600">{job.manufacturer_name || '—'}</td>
                    <td className="px-4 py-2.5 text-zinc-600 text-xs">{job.derived_material_type || '—'}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={job.status} /></td>
                    <td className="px-4 py-2.5 text-zinc-500 text-xs">
                      {new Date(job.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
      <div className="w-[480px] shrink-0 rounded-xl border border-zinc-200 bg-white overflow-y-auto">
        {detailLoading ? (
          <div className="p-6 text-zinc-400 text-sm">Loading...</div>
        ) : selected ? (
          <div className="p-6 space-y-5">
            {/* Original swatch */}
            <div className="rounded-lg overflow-hidden bg-zinc-100">
              <img src={selected.swatch_image_url} alt="" className="w-full" />
            </div>

            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-medium text-zinc-900">
                  {selected.material_name || 'Untitled Swatch'}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={selected.status} />
                  {selected.derived_material_type && (
                    <span className="text-xs text-zinc-500">{selected.derived_material_type}</span>
                  )}
                </div>
              </div>
              {analysis?.color_primary && (
                <div
                  className="w-8 h-8 rounded-lg border border-zinc-200"
                  style={{ backgroundColor: analysis.color_primary }}
                  title={`${analysis.color_description} (${analysis.color_primary})`}
                />
              )}
            </div>

            {/* Manufacturer info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {selected.manufacturer_name && (
                <Field label="Manufacturer" value={selected.manufacturer_name} />
              )}
              {selected.manufacturer_sku && (
                <Field label="SKU" value={selected.manufacturer_sku} mono />
              )}
            </div>

            {/* Vision analysis */}
            {analysis && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-2">
                  Vision Analysis
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <MiniField label="Category" value={analysis.material_category} />
                  <MiniField label="Subcategory" value={analysis.material_subcategory} />
                  <MiniField label="Weave" value={analysis.weave_pattern} />
                  <MiniField label="Finish" value={analysis.finish} />
                  <MiniField label="Scale" value={analysis.texture_scale} />
                  <MiniField label="Regularity" value={analysis.surface_regularity.replace(/_/g, ' ')} />
                  <MiniField label="Roughness" value={analysis.estimated_roughness.toFixed(2)} />
                  <MiniField label="Metallic" value={analysis.estimated_metallic.toFixed(2)} />
                  <div className="col-span-2">
                    <MiniField label="Color" value={`${analysis.color_description} (${analysis.color_primary})`} />
                  </div>
                  <div className="col-span-2">
                    <MiniField label="Tiling" value={analysis.tiling_recommendation} />
                  </div>
                  <MiniField label="Confidence" value={`${(analysis.confidence * 100).toFixed(0)}%`} />
                </div>
              </div>
            )}

            {/* PBR Map previews */}
            {selected.material_id && <PbrMaps jobId={selected.id} />}

            {/* Tiling preview */}
            {selected.preprocessed_albedo_url && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-2">
                  Tiling Preview (2x2)
                </div>
                <div className="grid grid-cols-2 gap-0 rounded-lg overflow-hidden bg-zinc-100">
                  {[0, 1, 2, 3].map((i) => (
                    <img
                      key={i}
                      src={selected.preprocessed_albedo_url!}
                      alt=""
                      className="w-full aspect-square object-cover"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {selected.derived_tags.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-1">Tags</div>
                <div className="flex flex-wrap gap-1">
                  {selected.derived_tags.map((t) => (
                    <span key={t} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Error */}
            {selected.error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                <div className="text-[10px] uppercase tracking-wider text-red-500 font-semibold mb-1">Error</div>
                <div className="text-xs text-red-700 font-mono">{selected.error}</div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t border-zinc-100">
              {selected.status === 'review' && (
                <>
                  <button
                    onClick={handleApprove}
                    className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={handleReject}
                    className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700"
                  >
                    Reject
                  </button>
                </>
              )}
              {selected.status === 'failed' && (
                <button
                  onClick={handleRetry}
                  className="flex-1 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800"
                >
                  Retry
                </button>
              )}
            </div>

            {/* Meta */}
            <div className="text-xs text-zinc-400 space-y-0.5">
              <div className="font-mono text-[10px] truncate">ID: {selected.id}</div>
              <div>Created: {new Date(selected.created_at).toLocaleString()}</div>
              <div>Updated: {new Date(selected.updated_at).toLocaleString()}</div>
              {selected.material_id && <div>Material ID: {selected.material_id}</div>}
            </div>
          </div>
        ) : (
          <div className="p-6 text-zinc-400 text-sm">Select a swatch job to view details.</div>
        )}
      </div>
    </div>
  );
}

function PbrMaps({ jobId }: { jobId: string }) {
  const maps = [
    { label: 'Albedo', file: 'albedo_seamless.png' },
    { label: 'Normal', file: 'normal_2k.png' },
    { label: 'Roughness', file: 'roughness_2k.png' },
    { label: 'Metallic', file: 'metallic_2k.png' },
    { label: 'AO', file: 'ao_2k.png' },
    { label: 'Height', file: 'height_2k.png' },
  ];

  const baseUrl = `${process.env.NEXT_PUBLIC_R2_ASSETS_URL || 'https://cdn.assets.spatialable.com'}/materials/swatch/${jobId}`;

  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-2">
        PBR Maps
      </div>
      <div className="grid grid-cols-3 gap-2">
        {maps.map(({ label, file }) => (
          <div key={label} className="space-y-1">
            <div className="aspect-square rounded-lg overflow-hidden bg-zinc-100">
              <img
                src={`${baseUrl}/${file}`}
                alt={label}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div className="text-[10px] text-center text-zinc-500">{label}</div>
          </div>
        ))}
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

function MiniField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-zinc-400 font-semibold">{label}</div>
      <div className="text-xs text-zinc-700 mt-0.5">{value}</div>
    </div>
  );
}
