'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { submitGeneration, pollJobStatus } from './actions';

// Pipeline steps in order
const PIPELINE_STEPS = [
  { key: 'queued', label: 'Queued' },
  { key: 'meshy_submitted', label: 'Meshy Submitted' },
  { key: 'mesh_ready', label: 'Mesh Ready' },
  { key: 'material_matching', label: 'Matching Materials' },
  { key: 'materials_matched', label: 'Materials Matched' },
  { key: 'review', label: 'Review' },
  { key: 'complete', label: 'Complete' },
];

type JobResult = Awaited<ReturnType<typeof pollJobStatus>>;

export function PocClient() {
  // Source images
  const [imageUrl, setImageUrl] = useState('');
  const [sourceImages, setSourceImages] = useState<string[]>([]);

  // Metadata
  const [name, setName] = useState('');
  const [upc, setUpc] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('');

  // Job state
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobResult, setJobResult] = useState<JobResult>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Add image URL
  const addImage = () => {
    const url = imageUrl.trim();
    if (!url || !url.startsWith('http')) return;
    if (sourceImages.includes(url)) return;
    setSourceImages((prev) => [...prev, url]);
    setImageUrl('');
  };

  const removeImage = (url: string) => {
    setSourceImages((prev) => prev.filter((u) => u !== url));
  };

  // Submit generation
  const handleSubmit = async () => {
    if (sourceImages.length === 0) return;
    setSubmitting(true);
    setError(null);
    setJobResult(null);

    try {
      const metadata: Record<string, string> = {};
      if (name) metadata.name = name;
      if (upc) metadata.upc = upc;
      if (sku) metadata.sku = sku;
      if (category) metadata.category = category;

      const result = await submitGeneration(sourceImages, metadata);

      if (result.existing_asset) {
        setError(`Asset already exists: ${result.existing_asset.id}`);
        setSubmitting(false);
        return;
      }

      if (result.job_id) {
        setJobId(result.job_id);
      }
    } catch (err: any) {
      setError(err.message || 'Submission failed');
    }
    setSubmitting(false);
  };

  // Poll job status
  const poll = useCallback(async () => {
    if (!jobId) return;
    try {
      const result = await pollJobStatus(jobId);
      setJobResult(result);
      if (result && (result.status === 'complete' || result.status === 'failed')) {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        if (result.status === 'failed') {
          setError(result.error || 'Job failed');
        }
      }
    } catch (err: any) {
      setError(err.message);
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;
    poll(); // immediate first poll
    pollingRef.current = setInterval(poll, 3000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [jobId, poll]);

  // Reset
  const handleReset = () => {
    setSourceImages([]);
    setImageUrl('');
    setName('');
    setUpc('');
    setSku('');
    setCategory('');
    setJobId(null);
    setJobResult(null);
    setError(null);
    if (pollingRef.current) clearInterval(pollingRef.current);
  };

  const currentStepIndex = jobResult
    ? PIPELINE_STEPS.findIndex((s) => s.key === jobResult.status)
    : -1;

  return (
    <div className="min-h-screen bg-zinc-50 p-8 font-sans">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">SpatialAble POC</h1>
          <p className="text-sm text-zinc-500">Pipeline test — source images to 3D asset</p>
        </div>

        {/* Source Images */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">Source Images</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addImage()}
              placeholder="Paste image URL..."
              className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              disabled={!!jobId}
            />
            <button
              onClick={addImage}
              disabled={!!jobId || !imageUrl.trim()}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40"
            >
              Add
            </button>
          </div>
          {sourceImages.length > 0 && (
            <div className="space-y-2">
              {sourceImages.map((url) => (
                <div key={url} className="flex items-center gap-3 rounded-lg bg-zinc-50 px-3 py-2">
                  <img
                    src={url}
                    alt=""
                    className="h-12 w-12 rounded object-cover border border-zinc-200"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <span className="flex-1 text-xs text-zinc-600 truncate">{url}</span>
                  {!jobId && (
                    <button
                      onClick={() => removeImage(url)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Metadata */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">Product Metadata (optional)</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
                disabled={!!jobId}
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. jewelry/rings"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
                disabled={!!jobId}
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">UPC</label>
              <input
                type="text"
                value={upc}
                onChange={(e) => setUpc(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
                disabled={!!jobId}
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">SKU</label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
                disabled={!!jobId}
              />
            </div>
          </div>
        </section>

        {/* Submit / Reset */}
        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={submitting || sourceImages.length === 0 || !!jobId}
            className="rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40"
          >
            {submitting ? 'Submitting...' : 'Generate 3D Asset'}
          </button>
          {jobId && (
            <button
              onClick={handleReset}
              className="rounded-lg border border-zinc-300 px-6 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Reset
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Pipeline Progress */}
        {jobId && (
          <section className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">Pipeline Progress</h2>
            <div className="flex items-center gap-1">
              {PIPELINE_STEPS.map((step, i) => {
                const isComplete = i < currentStepIndex;
                const isCurrent = i === currentStepIndex;
                const isFailed = jobResult?.status === 'failed' && isCurrent;

                return (
                  <div key={step.key} className="flex items-center gap-1 flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div
                        className={`
                          w-full h-2 rounded-full transition-colors
                          ${isFailed ? 'bg-red-500' : ''}
                          ${isComplete ? 'bg-green-500' : ''}
                          ${isCurrent && !isFailed ? 'bg-blue-500 animate-pulse' : ''}
                          ${!isComplete && !isCurrent ? 'bg-zinc-200' : ''}
                        `}
                      />
                      <span className={`text-[10px] mt-1 ${isCurrent ? 'text-zinc-900 font-medium' : 'text-zinc-400'}`}>
                        {step.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            {jobResult && (
              <div className="text-xs text-zinc-500 space-y-1">
                <p>Job: <span className="font-mono">{jobResult.id}</span></p>
                <p>Status: <span className="font-medium text-zinc-700">{jobResult.status}</span></p>
                {jobResult.started_at && <p>Started: {new Date(jobResult.started_at).toLocaleTimeString()}</p>}
                {jobResult.completed_at && <p>Completed: {new Date(jobResult.completed_at).toLocaleTimeString()}</p>}
              </div>
            )}
          </section>
        )}

        {/* Material Identification */}
        {jobResult?.identified_materials && (
          <section className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">Identified Materials</h2>
            <div className="space-y-2">
              {(jobResult.identified_materials as any).materials?.map((mat: any, i: number) => (
                <div key={i} className="flex items-center gap-4 rounded-lg bg-zinc-50 px-4 py-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-zinc-900">{mat.region}</p>
                    <p className="text-xs text-zinc-500">{mat.material_type} — {mat.color}, {mat.finish}</p>
                  </div>
                  <div className="text-xs text-zinc-400">
                    {Math.round(mat.confidence * 100)}% confidence
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 3D Viewer */}
        {jobResult?.asset?.glb_url && (
          <section className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">3D Asset</h2>
            <div className="aspect-square w-full max-w-lg mx-auto rounded-lg bg-zinc-100 overflow-hidden">
              {/* @ts-ignore — model-viewer is a web component */}
              <model-viewer
                src={jobResult.asset.glb_url}
                auto-rotate
                camera-controls
                shadow-intensity="1"
                style={{ width: '100%', height: '100%' }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs text-zinc-500">
              <div>
                <p>Asset ID: <span className="font-mono text-zinc-700">{jobResult.asset.id}</span></p>
                <p>Status: <span className="text-zinc-700">{jobResult.asset.status}</span></p>
              </div>
              <div>
                {jobResult.asset.file_size_bytes && (
                  <p>File size: <span className="text-zinc-700">{(jobResult.asset.file_size_bytes / 1024 / 1024).toFixed(1)} MB</span></p>
                )}
                {jobResult.asset.vertex_count && (
                  <p>Vertices: <span className="text-zinc-700">{jobResult.asset.vertex_count.toLocaleString()}</span></p>
                )}
              </div>
            </div>
            {jobResult.asset.thumbnail_url && (
              <div>
                <p className="text-xs text-zinc-500 mb-2">Thumbnail</p>
                <img src={jobResult.asset.thumbnail_url} alt="Asset thumbnail" className="h-24 rounded border border-zinc-200" />
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
