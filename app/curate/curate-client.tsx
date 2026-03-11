'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getSourceImages,
  getSourceImage,
  updateSourceImage,
  bulkUpdateStatus,
  queueForGeneration,
  getBrandTargets,
  addSourceImage,
  type SourceImageFilters,
} from './actions';
import type { SourceImage, BrandTarget, SourceFunnel, CurationStatus } from '@/lib/types';

const FUNNELS: { value: SourceFunnel; label: string }[] = [
  { value: 'brand_pull', label: 'Brand Pull' },
  { value: 'library', label: 'Library' },
  { value: 'web_search', label: 'Web Search' },
  { value: 'ai_generated', label: 'AI Generated' },
  { value: 'partner', label: 'Partner' },
];

const STATUSES: { value: CurationStatus; label: string; color: string }[] = [
  { value: 'pending', label: 'Pending', color: 'bg-zinc-100 text-zinc-600' },
  { value: 'candidate', label: 'Candidate', color: 'bg-green-100 text-green-700' },
  { value: 'queued', label: 'Queued', color: 'bg-blue-100 text-blue-700' },
  { value: 'generating', label: 'Generating', color: 'bg-purple-100 text-purple-700' },
  { value: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-700' },
];

const ANGLES = ['front', 'side', 'top', '3/4', 'detail'];
const BG_TYPES = ['white', 'lifestyle', 'studio', 'unknown'];

function statusBadge(status: CurationStatus) {
  const s = STATUSES.find((x) => x.value === status);
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${s?.color ?? 'bg-zinc-100 text-zinc-600'}`}>
      {s?.label ?? status}
    </span>
  );
}

export function CurateClient() {
  // Data
  const [images, setImages] = useState<SourceImage[]>([]);
  const [total, setTotal] = useState(0);
  const [brandTargets, setBrandTargets] = useState<BrandTarget[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterFunnel, setFilterFunnel] = useState<SourceFunnel | ''>('');
  const [filterStatus, setFilterStatus] = useState<CurationStatus | ''>('');
  const [filterBrandTarget, setFilterBrandTarget] = useState<number | ''>('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [page, setPage] = useState(1);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [detailImage, setDetailImage] = useState<SourceImage | null>(null);

  // Add image form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addUrl, setAddUrl] = useState('');
  const [addFunnel, setAddFunnel] = useState<SourceFunnel>('library');
  const [addProductName, setAddProductName] = useState('');
  const [addCategory, setAddCategory] = useState('');

  // Detail edit state
  const [editProductName, setEditProductName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editUpc, setEditUpc] = useState('');
  const [editSku, setEditSku] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAngle, setEditAngle] = useState('');
  const [editGroup, setEditGroup] = useState('');
  const [editRejectionReason, setEditRejectionReason] = useState('');
  const [saving, setSaving] = useState(false);

  // Load data
  const loadImages = useCallback(async () => {
    setLoading(true);
    const filters: SourceImageFilters = { page };
    if (filterFunnel) filters.funnel = filterFunnel;
    if (filterStatus) filters.curation_status = filterStatus;
    if (filterBrandTarget) filters.brand_target_id = filterBrandTarget as number;
    if (filterCategory) filters.category = filterCategory;
    if (filterGroup) filters.product_group = filterGroup;

    const result = await getSourceImages(filters);
    setImages(result.images);
    setTotal(result.total);
    setLoading(false);
  }, [page, filterFunnel, filterStatus, filterBrandTarget, filterCategory, filterGroup]);

  useEffect(() => { loadImages(); }, [loadImages]);

  useEffect(() => {
    getBrandTargets().then(setBrandTargets);
  }, []);

  // Select detail
  const selectImage = async (id: number) => {
    const img = await getSourceImage(id);
    if (!img) return;
    setDetailImage(img);
    setEditProductName(img.product_name ?? '');
    setEditCategory(img.category ?? '');
    setEditUpc(img.upc ?? '');
    setEditSku(img.sku ?? '');
    setEditDescription(img.description ?? '');
    setEditAngle(img.angle ?? '');
    setEditGroup(img.product_group ?? '');
    setEditRejectionReason(img.rejection_reason ?? '');
  };

  // Toggle selection
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === images.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(images.map((i) => i.id)));
    }
  };

  // Save detail edits
  const saveDetail = async () => {
    if (!detailImage) return;
    setSaving(true);
    const updated = await updateSourceImage(detailImage.id, {
      product_name: editProductName || null,
      category: editCategory || null,
      upc: editUpc || null,
      sku: editSku || null,
      description: editDescription || null,
      angle: editAngle || null,
      product_group: editGroup || null,
    });
    setDetailImage(updated);
    setSaving(false);
    loadImages();
  };

  // Status actions
  const approveImage = async (id: number) => {
    await updateSourceImage(id, { curation_status: 'candidate' });
    if (detailImage?.id === id) {
      setDetailImage({ ...detailImage, curation_status: 'candidate' });
    }
    loadImages();
  };

  const rejectImage = async (id: number, reason?: string) => {
    await updateSourceImage(id, { curation_status: 'rejected', rejection_reason: reason ?? (editRejectionReason || null) });
    if (detailImage?.id === id) {
      setDetailImage({ ...detailImage, curation_status: 'rejected' });
    }
    loadImages();
  };

  // Bulk actions
  const bulkApprove = async () => {
    await bulkUpdateStatus([...selectedIds], 'candidate');
    setSelectedIds(new Set());
    loadImages();
  };

  const bulkReject = async () => {
    await bulkUpdateStatus([...selectedIds], 'rejected');
    setSelectedIds(new Set());
    loadImages();
  };

  const bulkQueue = async () => {
    await queueForGeneration([...selectedIds]);
    setSelectedIds(new Set());
    loadImages();
  };

  // Add image
  const handleAdd = async () => {
    if (!addUrl.trim()) return;
    await addSourceImage({
      image_url: addUrl.trim(),
      original_url: addUrl.trim(),
      funnel: addFunnel,
      product_name: addProductName || undefined,
      category: addCategory || undefined,
    });
    setAddUrl('');
    setAddProductName('');
    setAddCategory('');
    setShowAddForm(false);
    loadImages();
  };

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="flex h-screen bg-zinc-50">
      {/* Left Panel — Grid */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-zinc-200">
        {/* Header + Filters */}
        <div className="border-b border-zinc-200 bg-white px-6 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-zinc-900">Source Curation</h1>
              <p className="text-xs text-zinc-500">{total} image{total !== 1 ? 's' : ''}</p>
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
            >
              + Add Image
            </button>
          </div>

          {/* Add form */}
          {showAddForm && (
            <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-4 space-y-3">
              <input
                type="text"
                value={addUrl}
                onChange={(e) => setAddUrl(e.target.value)}
                placeholder="Image URL..."
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              />
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={addFunnel}
                  onChange={(e) => setAddFunnel(e.target.value as SourceFunnel)}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                >
                  {FUNNELS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={addProductName}
                  onChange={(e) => setAddProductName(e.target.value)}
                  placeholder="Product name..."
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={addCategory}
                  onChange={(e) => setAddCategory(e.target.value)}
                  placeholder="Category..."
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={!addUrl.trim()}
                  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-40"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <select
              value={filterFunnel}
              onChange={(e) => { setFilterFunnel(e.target.value as any); setPage(1); }}
              className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs"
            >
              <option value="">All funnels</option>
              {FUNNELS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value as any); setPage(1); }}
              className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs"
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            {brandTargets.length > 0 && (
              <select
                value={filterBrandTarget}
                onChange={(e) => { setFilterBrandTarget(e.target.value ? Number(e.target.value) : ''); setPage(1); }}
                className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs"
              >
                <option value="">All brands</option>
                {brandTargets.map((bt) => (
                  <option key={bt.id} value={bt.id}>{bt.brand_name}</option>
                ))}
              </select>
            )}
            <input
              type="text"
              value={filterCategory}
              onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
              placeholder="Category..."
              className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs w-28"
            />
            <input
              type="text"
              value={filterGroup}
              onChange={(e) => { setFilterGroup(e.target.value); setPage(1); }}
              placeholder="Group..."
              className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs w-28"
            />
          </div>

          {/* Bulk actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-zinc-500">{selectedIds.size} selected</span>
              <button onClick={bulkApprove} className="rounded bg-green-600 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-green-700">
                Approve
              </button>
              <button onClick={bulkReject} className="rounded bg-red-600 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-red-700">
                Reject
              </button>
              <button onClick={bulkQueue} className="rounded bg-blue-600 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-blue-700">
                Queue Gen
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="text-[10px] text-zinc-500 hover:text-zinc-700">
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-sm text-zinc-400">Loading...</div>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-sm text-zinc-400">
              <p>No source images yet</p>
              <p className="text-xs mt-1">Click &quot;+ Add Image&quot; to get started</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <button onClick={selectAll} className="text-[10px] text-zinc-500 hover:text-zinc-700">
                  {selectedIds.size === images.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className={`
                      group relative rounded-lg border bg-white overflow-hidden cursor-pointer transition-all
                      ${detailImage?.id === img.id ? 'border-zinc-900 ring-1 ring-zinc-900' : 'border-zinc-200 hover:border-zinc-400'}
                      ${selectedIds.has(img.id) ? 'ring-2 ring-blue-400' : ''}
                    `}
                    onClick={() => selectImage(img.id)}
                  >
                    {/* Checkbox */}
                    <div
                      className="absolute top-1.5 left-1.5 z-10"
                      onClick={(e) => { e.stopPropagation(); toggleSelect(img.id); }}
                    >
                      <div className={`
                        w-4 h-4 rounded border flex items-center justify-center text-[10px]
                        ${selectedIds.has(img.id) ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white/80 border-zinc-300 opacity-0 group-hover:opacity-100'}
                      `}>
                        {selectedIds.has(img.id) && '✓'}
                      </div>
                    </div>

                    {/* Image */}
                    <div className="aspect-square bg-zinc-100">
                      <img
                        src={img.thumbnail_url || img.image_url}
                        alt={img.product_name ?? ''}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = ''; (e.target as HTMLImageElement).className = 'hidden'; }}
                      />
                    </div>

                    {/* Info */}
                    <div className="p-2 space-y-1">
                      <p className="text-[11px] font-medium text-zinc-800 truncate">
                        {img.product_name || 'Untitled'}
                      </p>
                      <div className="flex items-center justify-between">
                        {statusBadge(img.curation_status)}
                        {img.gtin ? (
                          <span className="font-mono text-[9px] text-indigo-500 truncate ml-1">{img.gtin}</span>
                        ) : img.category ? (
                          <span className="text-[9px] text-zinc-400 truncate ml-1">{img.category}</span>
                        ) : null}
                      </div>
                      {img.angle && (
                        <span className="text-[9px] text-zinc-400">{img.angle}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="rounded border border-zinc-300 px-2.5 py-1 text-xs disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <span className="text-xs text-zinc-500">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="rounded border border-zinc-300 px-2.5 py-1 text-xs disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right Panel — Detail */}
      <div className="w-[420px] flex-shrink-0 overflow-y-auto bg-white">
        {detailImage ? (
          <div className="p-6 space-y-5">
            {/* Preview */}
            <div className="aspect-square rounded-lg bg-zinc-100 overflow-hidden">
              <img
                src={detailImage.image_url}
                alt={detailImage.product_name ?? ''}
                className="w-full h-full object-contain"
              />
            </div>

            {/* Status + Actions */}
            <div className="flex items-center gap-2">
              {statusBadge(detailImage.curation_status)}
              <div className="flex-1" />
              {detailImage.curation_status !== 'candidate' && detailImage.curation_status !== 'queued' && (
                <button
                  onClick={() => approveImage(detailImage.id)}
                  className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
                >
                  Approve
                </button>
              )}
              {detailImage.curation_status !== 'rejected' && (
                <button
                  onClick={() => rejectImage(detailImage.id)}
                  className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
                >
                  Reject
                </button>
              )}
              {detailImage.curation_status === 'candidate' && (
                <button
                  onClick={async () => { await queueForGeneration([detailImage.id]); loadImages(); }}
                  className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
                >
                  Queue Gen
                </button>
              )}
            </div>

            {/* Rejection reason */}
            {(detailImage.curation_status === 'rejected' || detailImage.curation_status === 'pending') && (
              <div>
                <label className="block text-[10px] text-zinc-400 mb-1 uppercase tracking-wide">Rejection Reason</label>
                <input
                  type="text"
                  value={editRejectionReason}
                  onChange={(e) => setEditRejectionReason(e.target.value)}
                  placeholder="Why rejected..."
                  className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-xs focus:border-zinc-500 focus:outline-none"
                />
              </div>
            )}

            {/* Editable metadata */}
            <div className="space-y-3">
              <h3 className="text-[10px] text-zinc-400 uppercase tracking-wide font-semibold">Product Info</h3>
              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">Name</label>
                <input
                  type="text"
                  value={editProductName}
                  onChange={(e) => setEditProductName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-xs focus:border-zinc-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">Category</label>
                  <input
                    type="text"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    placeholder="e.g. jewelry/rings"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-xs focus:border-zinc-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">Product Group</label>
                  <input
                    type="text"
                    value={editGroup}
                    onChange={(e) => setEditGroup(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-xs focus:border-zinc-500 focus:outline-none"
                  />
                </div>
              </div>
              {detailImage.gtin && (
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">GTIN</label>
                  <p className="font-mono text-xs text-indigo-600 bg-indigo-50 rounded-lg px-3 py-1.5">{detailImage.gtin}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">UPC</label>
                  <input
                    type="text"
                    value={editUpc}
                    onChange={(e) => setEditUpc(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-xs focus:border-zinc-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">SKU</label>
                  <input
                    type="text"
                    value={editSku}
                    onChange={(e) => setEditSku(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-xs focus:border-zinc-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-xs focus:border-zinc-500 focus:outline-none resize-none"
                />
              </div>
            </div>

            {/* Image metadata */}
            <div className="space-y-3">
              <h3 className="text-[10px] text-zinc-400 uppercase tracking-wide font-semibold">Image Info</h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">Angle</label>
                  <select
                    value={editAngle}
                    onChange={(e) => setEditAngle(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-xs"
                  >
                    <option value="">Unknown</option>
                    {ANGLES.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">Background</label>
                  <span className="text-xs text-zinc-700">{detailImage.background_type || 'Unknown'}</span>
                </div>
              </div>
              {(detailImage.width || detailImage.height) && (
                <p className="text-[10px] text-zinc-400">
                  {detailImage.width} x {detailImage.height}
                  {detailImage.file_size_bytes && ` — ${(detailImage.file_size_bytes / 1024).toFixed(0)} KB`}
                </p>
              )}
              {detailImage.original_url && (
                <p className="text-[10px] text-zinc-400 truncate" title={detailImage.original_url}>
                  Source: {detailImage.original_url}
                </p>
              )}
              {detailImage.quality_score != null && (
                <p className="text-[10px] text-zinc-400">
                  Quality: {Math.round(detailImage.quality_score * 100)}%
                </p>
              )}
            </div>

            {/* Save */}
            <button
              onClick={saveDetail}
              disabled={saving}
              className="w-full rounded-lg bg-zinc-900 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-40"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>

            {/* Timestamps */}
            <div className="text-[10px] text-zinc-400 space-y-0.5">
              <p>Created: {new Date(detailImage.created_at).toLocaleString()}</p>
              <p>Updated: {new Date(detailImage.updated_at).toLocaleString()}</p>
              {detailImage.generation_job_id && (
                <p>Job: <span className="font-mono">{detailImage.generation_job_id}</span></p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-zinc-400">
            Select an image to view details
          </div>
        )}
      </div>
    </div>
  );
}
