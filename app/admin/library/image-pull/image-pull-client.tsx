'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getBrandTargetsForPull,
  getBrandTarget,
  createBrandTarget,
  updatePullConfig,
  testSitemaps,
  getDiscoveryPreview,
  startPull,
  getPullRuns,
  getRunProgress,
} from './actions';
import type { BrandTargetWithPull, PullRun, PullRunProgress } from '@/lib/pull/types';

// ---------------------------------------------------------------------------
// Status badge colors
// ---------------------------------------------------------------------------

const RUN_STATUS_COLORS: Record<string, string> = {
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-zinc-100 text-zinc-600',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${RUN_STATUS_COLORS[status] || 'bg-zinc-100 text-zinc-600'}`}>
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ImagePullClient() {
  const [targets, setTargets] = useState<BrandTargetWithPull[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BrandTargetWithPull | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  // Pull config editing
  const [editSitemaps, setEditSitemaps] = useState('');
  const [editInclude, setEditInclude] = useState('');
  const [editExclude, setEditExclude] = useState('');
  const [editDelay, setEditDelay] = useState(500);

  // Test/preview state
  const [testResult, setTestResult] = useState<{ success: boolean; urls: string[]; totalFound: number; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [preview, setPreview] = useState<{ totalUrls: number; newProducts: number; alreadyImported: number } | null>(null);
  const [previewing, setPreviewing] = useState(false);

  // Run state
  const [runs, setRuns] = useState<PullRun[]>([]);
  const [activeProgress, setActiveProgress] = useState<PullRunProgress | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadTargets = useCallback(async () => {
    setLoading(true);
    const result = await getBrandTargetsForPull();
    setTargets(result);
    setLoading(false);
  }, []);

  useEffect(() => { loadTargets(); }, [loadTargets]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const selectTarget = async (id: number) => {
    const target = await getBrandTarget(id);
    if (!target) return;
    setSelected(target);
    setEditSitemaps((target.sitemaps || []).join('\n'));
    setEditInclude(target.url_pattern_include || '');
    setEditExclude(target.url_pattern_exclude || '');
    setEditDelay(target.request_delay_ms || 500);
    setTestResult(null);
    setPreview(null);
    setActiveProgress(null);

    // Load runs
    const runList = await getPullRuns(id);
    setRuns(runList);

    // If there's an active run, start polling
    if (pollRef.current) clearInterval(pollRef.current);
    const activeRun = runList.find((r) => r.status === 'running');
    if (activeRun) {
      setActiveRunId(activeRun.id);
      startPolling(activeRun.id);
    } else {
      setActiveRunId(null);
    }
  };

  const startPolling = (runId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const progress = await getRunProgress(runId);
      setActiveProgress(progress);
      if (progress && progress.status !== 'running') {
        if (pollRef.current) clearInterval(pollRef.current);
        setActiveRunId(null);
        // Refresh runs and target
        if (selected) {
          const runList = await getPullRuns(selected.id);
          setRuns(runList);
          const updated = await getBrandTarget(selected.id);
          if (updated) setSelected(updated);
        }
        loadTargets();
      }
    }, 3000);
  };

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    await createBrandTarget({
      name: fd.get('name') as string,
      brand_name: fd.get('brand_name') as string,
      website_url: (fd.get('website_url') as string) || undefined,
      notes: (fd.get('notes') as string) || undefined,
    });
    setSaving(false);
    setShowAdd(false);
    loadTargets();
  };

  const handleSaveConfig = async () => {
    if (!selected) return;
    setSaving(true);
    const sitemaps = editSitemaps
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    await updatePullConfig(selected.id, {
      sitemaps,
      url_pattern_include: editInclude || null,
      url_pattern_exclude: editExclude || null,
      request_delay_ms: editDelay,
    });
    const updated = await getBrandTarget(selected.id);
    if (updated) setSelected(updated);
    setSaving(false);
    loadTargets();
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const sitemaps = editSitemaps.split('\n').map((s) => s.trim()).filter(Boolean);
    const result = await testSitemaps(sitemaps, editInclude || undefined, editExclude || undefined);
    setTestResult(result);
    setTesting(false);
  };

  const handlePreview = async () => {
    if (!selected) return;
    setPreviewing(true);
    setPreview(null);
    const result = await getDiscoveryPreview(selected.id);
    setPreview(result);
    setPreviewing(false);
  };

  const handleStartPull = async () => {
    if (!selected) return;
    const { runId } = await startPull(selected.id);
    setActiveRunId(runId);
    setActiveProgress({ status: 'running', discovered_urls: 0, processed_count: 0, created_count: 0, skipped_count: 0, failed_count: 0, current_url: null });
    startPolling(runId);

    // Refresh runs
    const runList = await getPullRuns(selected.id);
    setRuns(runList);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Image Pull</h1>
          <p className="text-sm text-zinc-500 mt-1">Pull product images from brand websites</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800"
        >
          Add Brand Target
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="p-4 rounded-xl border border-zinc-200 bg-white space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input name="name" placeholder="Target name" required className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs" />
            <input name="brand_name" placeholder="Brand name" required className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs" />
            <input name="website_url" placeholder="Website URL" className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs" />
            <input name="notes" placeholder="Notes" className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs" />
          </div>
          <div className="flex items-center gap-2">
            <button type="submit" disabled={saving} className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
              {saving ? 'Creating...' : 'Create'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="text-xs text-zinc-500 hover:text-zinc-700">Cancel</button>
          </div>
        </form>
      )}

      {/* Brand Targets Table */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-4 text-zinc-400 text-sm">Loading...</div>
        ) : targets.length === 0 ? (
          <div className="p-4 text-zinc-400 text-sm">No brand targets. Add one to get started.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-[10px] uppercase tracking-wider text-zinc-400 border-b border-zinc-100 bg-white">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Name</th>
                <th className="px-4 py-2.5 font-semibold">Brand</th>
                <th className="px-4 py-2.5 font-semibold">Website</th>
                <th className="px-4 py-2.5 font-semibold text-right">Sitemaps</th>
                <th className="px-4 py-2.5 font-semibold text-right">Discovered</th>
                <th className="px-4 py-2.5 font-semibold text-right">Pulled</th>
                <th className="px-4 py-2.5 font-semibold">Last Pull</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {targets.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => selectTarget(t.id)}
                  className={`border-b border-zinc-50 cursor-pointer transition-colors ${
                    selected?.id === t.id ? 'bg-zinc-50' : 'hover:bg-zinc-50/50'
                  }`}
                >
                  <td className="px-4 py-2.5 font-medium text-zinc-900">{t.name}</td>
                  <td className="px-4 py-2.5 text-zinc-600">{t.brand_name}</td>
                  <td className="px-4 py-2.5 text-zinc-500 text-xs truncate max-w-[200px]">{t.website_url || '—'}</td>
                  <td className="px-4 py-2.5 text-zinc-600 text-right">{(t.sitemaps || []).length}</td>
                  <td className="px-4 py-2.5 text-zinc-600 text-right">{t.discovered_count}</td>
                  <td className="px-4 py-2.5 text-zinc-600 text-right">{t.pulled_count}</td>
                  <td className="px-4 py-2.5 text-zinc-500 text-xs">
                    {t.last_pull_at ? new Date(t.last_pull_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    {t.latest_run_status ? <StatusBadge status={t.latest_run_status} /> : <span className="text-zinc-400 text-xs">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Selected target detail */}
      {selected && (
        <div className="grid grid-cols-2 gap-6">
          {/* Pull Configuration */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">Pull Configuration</h2>
              <span className="text-xs text-zinc-400">{selected.name}</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold block mb-1">
                  Sitemaps (one per line)
                </label>
                <textarea
                  value={editSitemaps}
                  onChange={(e) => setEditSitemaps(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-mono"
                  placeholder="https://www.brand.com/sitemap.xml"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold block mb-1">
                    Include pattern
                  </label>
                  <input
                    value={editInclude}
                    onChange={(e) => setEditInclude(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-mono"
                    placeholder="/products/[^/]+$"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold block mb-1">
                    Exclude pattern
                  </label>
                  <input
                    value={editExclude}
                    onChange={(e) => setEditExclude(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-mono"
                    placeholder="gift-card|bundle"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold block mb-1">
                  Request delay (ms)
                </label>
                <input
                  type="number"
                  value={editDelay}
                  onChange={(e) => setEditDelay(parseInt(e.target.value) || 500)}
                  className="w-32 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs"
                  min={100}
                  step={100}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
              <button onClick={handleSaveConfig} disabled={saving} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Config'}
              </button>
              <button onClick={handleTest} disabled={testing} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">
                {testing ? 'Testing...' : 'Test Sitemaps'}
              </button>
              <button onClick={handlePreview} disabled={previewing} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">
                {previewing ? 'Checking...' : 'Discovery Preview'}
              </button>
              <button
                onClick={handleStartPull}
                disabled={!!activeRunId || (selected.sitemaps || []).length === 0}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 ml-auto"
              >
                {activeRunId ? 'Running...' : 'Start Pull'}
              </button>
            </div>

            {/* Test result */}
            {testResult && (
              <div className={`rounded-lg p-3 text-xs ${testResult.success ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                {testResult.success ? (
                  <>
                    <div className="font-medium text-emerald-700 mb-1">Found {testResult.totalFound} product URLs</div>
                    {testResult.urls.length > 0 && (
                      <div className="space-y-0.5 text-emerald-600 font-mono text-[10px]">
                        {testResult.urls.map((url) => (
                          <div key={url} className="truncate">{url}</div>
                        ))}
                        {testResult.totalFound > testResult.urls.length && (
                          <div className="text-emerald-500">...and {testResult.totalFound - testResult.urls.length} more</div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-red-700">{testResult.error || 'Test failed'}</div>
                )}
              </div>
            )}

            {/* Discovery preview */}
            {preview && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-lg font-bold text-blue-700">{preview.totalUrls}</div>
                    <div className="text-blue-500">Total URLs</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-emerald-700">{preview.newProducts}</div>
                    <div className="text-emerald-500">New</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-zinc-500">{preview.alreadyImported}</div>
                    <div className="text-zinc-400">Already imported</div>
                  </div>
                </div>
              </div>
            )}

            {/* Active run progress */}
            {activeProgress && activeProgress.status === 'running' && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <StatusBadge status="running" />
                  <span className="text-blue-600">
                    {activeProgress.processed_count} / {activeProgress.discovered_urls} products
                  </span>
                </div>

                {/* Progress bar */}
                {activeProgress.discovered_urls > 0 && (
                  <div className="w-full h-1.5 bg-blue-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-500"
                      style={{ width: `${Math.round((activeProgress.processed_count / activeProgress.discovered_urls) * 100)}%` }}
                    />
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="font-medium text-emerald-700">{activeProgress.created_count}</span>
                    <span className="text-zinc-400 ml-1">created</span>
                  </div>
                  <div>
                    <span className="font-medium text-zinc-500">{activeProgress.skipped_count}</span>
                    <span className="text-zinc-400 ml-1">skipped</span>
                  </div>
                  <div>
                    <span className="font-medium text-red-600">{activeProgress.failed_count}</span>
                    <span className="text-zinc-400 ml-1">failed</span>
                  </div>
                </div>

                {activeProgress.current_url && (
                  <div className="text-[10px] text-blue-500 font-mono truncate">
                    {activeProgress.current_url}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Run History */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-900">Run History</h2>

            {runs.length === 0 ? (
              <div className="text-sm text-zinc-400">No pull runs yet.</div>
            ) : (
              <div className="space-y-2">
                {runs.map((run) => (
                  <div key={run.id} className="rounded-lg border border-zinc-100 p-3 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <StatusBadge status={run.status} />
                      <span className="text-zinc-400 text-[10px]">
                        {new Date(run.started_at).toLocaleString()}
                        {run.completed_at && (
                          <span className="ml-1">
                            ({formatDuration(new Date(run.started_at), new Date(run.completed_at))})
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-2 text-center">
                      <MiniStat label="Discovered" value={run.discovered_urls} />
                      <MiniStat label="Processed" value={run.processed_count} />
                      <MiniStat label="Created" value={run.created_count} color="text-emerald-700" />
                      <MiniStat label="Skipped" value={run.skipped_count} />
                      <MiniStat label="Failed" value={run.failed_count} color={run.failed_count > 0 ? 'text-red-600' : undefined} />
                    </div>
                    {run.errors && run.errors.length > 0 && (
                      <details className="text-[10px] text-red-500">
                        <summary className="cursor-pointer">{run.errors.length} errors</summary>
                        <div className="mt-1 space-y-0.5 font-mono max-h-32 overflow-y-auto">
                          {run.errors.slice(0, 10).map((err, i) => (
                            <div key={i} className="truncate">{err.url}: {err.error}</div>
                          ))}
                          {run.errors.length > 10 && <div>...and {run.errors.length - 10} more</div>}
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function MiniStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <div className={`text-sm font-medium ${color || 'text-zinc-700'}`}>{value}</div>
      <div className="text-[9px] text-zinc-400 uppercase">{label}</div>
    </div>
  );
}

function formatDuration(start: Date, end: Date): string {
  const ms = end.getTime() - start.getTime();
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}
