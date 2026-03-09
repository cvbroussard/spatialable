'use client';

import { useState, useEffect, useCallback } from 'react';
import { getProductSets, getProductAssets, removeProductAsset, reorderProductAssets } from './actions';

interface ProductSet {
  product_ref: string;
  asset_count: number;
  role_count: number;
  first_added: string;
  last_updated: string;
}

interface ProductAssetRow {
  id: number;
  product_ref: string;
  asset_id: string;
  role: string;
  position: number;
  content_type: string;
  url: string;
  alt: string | null;
  asset_thumbnail: string | null;
  asset_status: string | null;
  asset_specificity: string | null;
  asset_category: string | null;
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    hero: 'bg-amber-100 text-amber-700',
    gallery: 'bg-blue-100 text-blue-700',
    detail: 'bg-sky-100 text-sky-700',
    lifestyle: 'bg-pink-100 text-pink-700',
    video: 'bg-purple-100 text-purple-700',
    model: 'bg-emerald-100 text-emerald-700',
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${colors[role] || 'bg-zinc-100 text-zinc-600'}`}>
      {role}
    </span>
  );
}

export function ProductsClient() {
  const [products, setProducts] = useState<ProductSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [assets, setAssets] = useState<ProductAssetRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const result = await getProductSets();
    setProducts(result as ProductSet[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const selectProduct = async (ref: string) => {
    setSelectedRef(ref);
    setDetailLoading(true);
    const result = await getProductAssets(ref);
    setAssets(result as ProductAssetRow[]);
    setDetailLoading(false);
  };

  const handleRemove = async (id: number) => {
    if (!selectedRef) return;
    await removeProductAsset(id);
    const result = await getProductAssets(selectedRef);
    setAssets(result as ProductAssetRow[]);
    await loadProducts();
  };

  const moveAsset = async (index: number, direction: -1 | 1) => {
    if (!selectedRef) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= assets.length) return;

    const reordered = [...assets];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, moved);

    const orderedIds = reordered.map((a) => a.id);
    await reorderProductAssets(selectedRef, orderedIds);
    const result = await getProductAssets(selectedRef);
    setAssets(result as ProductAssetRow[]);
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {/* Left — product list */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-zinc-900">Product Sets</h1>
          <p className="text-sm text-zinc-500 mt-1">{products.length} curated product{products.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-zinc-400 text-sm">Loading product sets...</div>
          ) : products.length === 0 ? (
            <div className="text-zinc-400 text-sm">No product sets yet. Assign assets to products to create sets.</div>
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Product Ref</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Assets</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Roles</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr
                      key={p.product_ref}
                      onClick={() => selectProduct(p.product_ref)}
                      className={`border-b border-zinc-50 cursor-pointer transition-colors ${
                        selectedRef === p.product_ref ? 'bg-zinc-100' : 'even:bg-zinc-50 hover:bg-zinc-50'
                      }`}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-zinc-700">{p.product_ref}</td>
                      <td className="px-4 py-2.5 text-zinc-600">{p.asset_count}</td>
                      <td className="px-4 py-2.5 text-zinc-600">{p.role_count}</td>
                      <td className="px-4 py-2.5 text-zinc-500">{new Date(p.last_updated).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Right — asset order editor */}
      <div className="w-[420px] shrink-0 rounded-xl border border-zinc-200 bg-white overflow-y-auto">
        {detailLoading ? (
          <div className="p-6 text-zinc-400 text-sm">Loading...</div>
        ) : selectedRef ? (
          <div className="p-6 space-y-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-1">Product</div>
              <div className="font-mono text-sm text-zinc-900">{selectedRef}</div>
            </div>

            <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
              Asset Order ({assets.length})
            </div>

            <div className="space-y-2">
              {assets.map((asset, i) => (
                <div
                  key={asset.id}
                  className="flex items-center gap-3 rounded-lg border border-zinc-200 p-2.5 bg-white"
                >
                  {/* Thumbnail */}
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-zinc-100 shrink-0">
                    {asset.asset_thumbnail ? (
                      <img src={asset.asset_thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-300 text-[10px]">—</div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-medium text-zinc-700">#{asset.position}</span>
                      <RoleBadge role={asset.role} />
                    </div>
                    <div className="text-[11px] text-zinc-500 truncate">
                      {asset.asset_id.slice(0, 8)}... {asset.content_type || ''}
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      onClick={() => moveAsset(i, -1)}
                      disabled={i === 0}
                      className="w-6 h-6 flex items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 disabled:opacity-20"
                      title="Move up"
                    >
                      &#9650;
                    </button>
                    <button
                      onClick={() => moveAsset(i, 1)}
                      disabled={i === assets.length - 1}
                      className="w-6 h-6 flex items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 disabled:opacity-20"
                      title="Move down"
                    >
                      &#9660;
                    </button>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => handleRemove(asset.id)}
                    className="shrink-0 text-xs text-red-500 hover:text-red-700"
                    title="Remove"
                  >
                    &#10005;
                  </button>
                </div>
              ))}
            </div>

            {assets.length === 0 && (
              <div className="text-zinc-400 text-sm">No assets assigned to this product.</div>
            )}
          </div>
        ) : (
          <div className="p-6 text-zinc-400 text-sm">Select a product to edit its asset order.</div>
        )}
      </div>
    </div>
  );
}
