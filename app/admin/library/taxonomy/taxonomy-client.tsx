'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getFormFactors,
  getTaxonomyMappings,
  upsertTaxonomyMapping,
  deleteTaxonomyMapping,
} from './actions';

interface FormFactorRow {
  id: number;
  parent_id: number | null;
  category_path: string;
  name: string;
  structural_attributes: Record<string, any>;
  base_mesh_url: string | null;
  asset_count: number;
}

interface TaxonomyRow {
  id: number;
  shopify_type: string;
  category_path: string;
  form_factor_id: number | null;
  form_factor_name: string | null;
  created_at: string;
}

interface TreeNode {
  segment: string;
  path: string;
  formFactor: FormFactorRow | null;
  children: TreeNode[];
}

function buildTree(factors: FormFactorRow[]): TreeNode[] {
  const root: TreeNode[] = [];
  const nodeMap = new Map<string, TreeNode>();

  // Collect all unique path segments
  const allPaths = new Set<string>();
  for (const ff of factors) {
    const parts = ff.category_path.split('/');
    for (let i = 1; i <= parts.length; i++) {
      allPaths.add(parts.slice(0, i).join('/'));
    }
  }

  // Create nodes for each path
  for (const path of Array.from(allPaths).sort()) {
    const parts = path.split('/');
    const segment = parts[parts.length - 1];
    const ff = factors.find((f) => f.category_path === path) || null;
    const node: TreeNode = { segment, path, formFactor: ff, children: [] };
    nodeMap.set(path, node);

    if (parts.length === 1) {
      root.push(node);
    } else {
      const parentPath = parts.slice(0, -1).join('/');
      const parent = nodeMap.get(parentPath);
      if (parent) parent.children.push(node);
      else root.push(node);
    }
  }

  return root;
}

function TreeItem({ node, depth }: { node: TreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <button
        onClick={() => hasChildren && setExpanded(!expanded)}
        className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-zinc-50 transition-colors ${
          hasChildren ? 'cursor-pointer' : 'cursor-default'
        }`}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
      >
        {hasChildren ? (
          <span className="text-zinc-400 w-3 text-center">{expanded ? '▾' : '▸'}</span>
        ) : (
          <span className="w-3" />
        )}
        <span className={`${node.formFactor ? 'text-zinc-900 font-medium' : 'text-zinc-500'}`}>
          {node.segment}
        </span>
        {node.formFactor && (
          <span className="text-zinc-400 text-[10px]">
            {node.formFactor.asset_count} asset{node.formFactor.asset_count !== 1 ? 's' : ''}
          </span>
        )}
      </button>
      {expanded && node.children.map((child) => (
        <TreeItem key={child.path} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export function TaxonomyClient() {
  const [tab, setTab] = useState<'form_factors' | 'shopify_map'>('form_factors');
  const [formFactors, setFormFactors] = useState<FormFactorRow[]>([]);
  const [mappings, setMappings] = useState<TaxonomyRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Add/edit form
  const [editId, setEditId] = useState<number | null>(null);
  const [editShopifyType, setEditShopifyType] = useState('');
  const [editCategoryPath, setEditCategoryPath] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [ff, tm] = await Promise.all([getFormFactors(), getTaxonomyMappings()]);
    setFormFactors(ff as FormFactorRow[]);
    setMappings(tm as TaxonomyRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const tree = buildTree(formFactors);

  const handleSaveMapping = async () => {
    if (!editShopifyType.trim() || !editCategoryPath.trim()) return;
    await upsertTaxonomyMapping({
      id: editId ?? undefined,
      shopify_type: editShopifyType.trim(),
      category_path: editCategoryPath.trim(),
    });
    setEditId(null);
    setEditShopifyType('');
    setEditCategoryPath('');
    setShowAddForm(false);
    await load();
  };

  const handleDeleteMapping = async (id: number) => {
    await deleteTaxonomyMapping(id);
    await load();
  };

  const startEdit = (m: TaxonomyRow) => {
    setEditId(m.id);
    setEditShopifyType(m.shopify_type);
    setEditCategoryPath(m.category_path);
    setShowAddForm(true);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditShopifyType('');
    setEditCategoryPath('');
    setShowAddForm(false);
  };

  if (loading) {
    return <div className="text-zinc-400 text-sm">Loading taxonomy...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Taxonomy</h1>
        <p className="text-sm text-zinc-500 mt-1">Form factors &amp; Shopify type mappings</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200">
        <button
          onClick={() => setTab('form_factors')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'form_factors'
              ? 'border-zinc-900 text-zinc-900'
              : 'border-transparent text-zinc-400 hover:text-zinc-600'
          }`}
        >
          Form Factors ({formFactors.length})
        </button>
        <button
          onClick={() => setTab('shopify_map')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'shopify_map'
              ? 'border-zinc-900 text-zinc-900'
              : 'border-transparent text-zinc-400 hover:text-zinc-600'
          }`}
        >
          Shopify Map ({mappings.length})
        </button>
      </div>

      {/* Form Factors Tree */}
      {tab === 'form_factors' && (
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          {tree.length === 0 ? (
            <div className="px-4 py-6 text-center text-zinc-400 text-sm">No form factors defined yet.</div>
          ) : (
            <div className="py-2">
              {tree.map((node) => (
                <TreeItem key={node.path} node={node} depth={0} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Shopify Taxonomy Map */}
      {tab === 'shopify_map' && (
        <div className="space-y-4">
          {/* Add/Edit form */}
          <div className="flex items-end gap-3">
            {showAddForm ? (
              <>
                <div className="flex-1">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">Shopify Type</label>
                  <input
                    value={editShopifyType}
                    onChange={(e) => setEditShopifyType(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs"
                    placeholder="e.g. Sofas"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">Category Path</label>
                  <input
                    value={editCategoryPath}
                    onChange={(e) => setEditCategoryPath(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs"
                    placeholder="e.g. furniture/seating/sofas"
                  />
                </div>
                <button
                  onClick={handleSaveMapping}
                  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
                >
                  {editId ? 'Update' : 'Add'}
                </button>
                <button
                  onClick={cancelEdit}
                  className="rounded-lg bg-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-300"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowAddForm(true)}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
              >
                + Add Mapping
              </button>
            )}
          </div>

          {/* Table */}
          <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Shopify Type</th>
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Category Path</th>
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-500">Form Factor</th>
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-500 w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mappings.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-zinc-400 text-sm">
                      No Shopify taxonomy mappings yet.
                    </td>
                  </tr>
                ) : (
                  mappings.map((m) => (
                    <tr key={m.id} className="border-b border-zinc-50 even:bg-zinc-50">
                      <td className="px-4 py-2.5 text-zinc-900 font-medium">{m.shopify_type}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-zinc-600">{m.category_path}</td>
                      <td className="px-4 py-2.5 text-zinc-500">{m.form_factor_name || '—'}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => startEdit(m)}
                            className="text-xs text-zinc-500 hover:text-zinc-700 underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteMapping(m.id)}
                            className="text-xs text-red-500 hover:text-red-700 underline"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
