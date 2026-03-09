'use client';

import { useState, useEffect, useCallback } from 'react';
import { getLibraryStats } from './actions';

interface Stats {
  assets: { total: number; approved: number; review: number; generating: number; rejected: number };
  sources: { total: number; pending: number; candidate: number; queued: number; generating: number; rejected: number };
  materials: number;
  formFactors: number;
  productSets: number;
  recentJobs: Array<{
    id: string;
    status: string;
    product_metadata: any;
    created_at: string;
    completed_at: string | null;
  }>;
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-1">{label}</div>
      <div className="text-2xl font-bold text-zinc-900">{value.toLocaleString()}</div>
      {sub && <div className="text-xs text-zinc-500 mt-1">{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    complete: 'bg-green-100 text-green-700',
    approved: 'bg-green-100 text-green-700',
    review: 'bg-blue-100 text-blue-700',
    generating: 'bg-purple-100 text-purple-700',
    queued: 'bg-yellow-100 text-yellow-700',
    failed: 'bg-red-100 text-red-700',
    rejected: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${colors[status] || 'bg-zinc-100 text-zinc-600'}`}>
      {status}
    </span>
  );
}

export function LibraryClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getLibraryStats();
    setStats(result as Stats);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading || !stats) {
    return <div className="text-zinc-400 text-sm">Loading library stats...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Library</h1>
        <p className="text-sm text-zinc-500 mt-1">Catalog overview</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Assets"
          value={stats.assets.total}
          sub={`${stats.assets.approved} approved, ${stats.assets.review} review, ${stats.assets.generating} generating`}
        />
        <StatCard
          label="Source Images"
          value={stats.sources.total}
          sub={`${stats.sources.candidate} candidates, ${stats.sources.pending} pending`}
        />
        <StatCard label="Materials" value={stats.materials} />
        <StatCard label="Form Factors" value={stats.formFactors} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Product Sets" value={stats.productSets} sub="Curated product media sets" />
      </div>

      {/* Recent Jobs */}
      <div>
        <h2 className="text-lg font-bold text-zinc-900 mb-3">Recent Generation Jobs</h2>
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Job ID</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Product</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Created</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentJobs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-400 text-sm">
                    No generation jobs yet
                  </td>
                </tr>
              ) : (
                stats.recentJobs.map((job) => (
                  <tr key={job.id} className="border-b border-zinc-50 even:bg-zinc-50">
                    <td className="px-4 py-2.5 font-mono text-xs text-zinc-500">{job.id.slice(0, 8)}...</td>
                    <td className="px-4 py-2.5 text-zinc-700">{job.product_metadata?.name || '—'}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={job.status} /></td>
                    <td className="px-4 py-2.5 text-zinc-500">{new Date(job.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
