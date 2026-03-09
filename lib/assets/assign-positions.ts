import type { AssetRole } from '@/lib/types';

// ---------------------------------------------------------------------------
// Convention-based position assignment for product asset sets
//
// Editorial sort order:
//   0     hero         Primary product image (3/4 angle)
//   1-N   gallery      Additional angles (front, side, back, top)
//   N+1   detail       Close-ups, texture, swatch
//   N+2   lifestyle    Room scene, styled setting
//   N+3   video        360 spin, feature demo
//   N+4   model        3D GLB — always last
//
// One curated sequence per product. Renderers slice it:
//   hero         → position 0
//   gallery      → all, in order
//   configurator → role 'model'
// ---------------------------------------------------------------------------

const ROLE_ORDER: AssetRole[] = ['hero', 'gallery', 'detail', 'lifestyle', 'video', 'model'];

export interface AssetInput {
  asset_id: string;
  role: AssetRole;
  content_type: string;
  url: string;
  alt?: string | null;
}

export interface PositionedAsset extends AssetInput {
  position: number;
}

/**
 * Assign positions to an unordered set of assets by convention.
 *
 * Assets are grouped by role, sorted within each group by their original
 * array order (stable sort), then assigned sequential positions starting
 * from 0.
 *
 * @param assets - Unordered assets with role designations
 * @returns Same assets with position assigned
 */
export function assignPositions(assets: AssetInput[]): PositionedAsset[] {
  // Group by role, preserving input order within each group
  const groups = new Map<AssetRole, AssetInput[]>();
  for (const role of ROLE_ORDER) {
    groups.set(role, []);
  }
  for (const asset of assets) {
    const group = groups.get(asset.role);
    if (group) {
      group.push(asset);
    }
  }

  // Flatten in convention order and assign positions
  const result: PositionedAsset[] = [];
  let position = 0;

  for (const role of ROLE_ORDER) {
    const group = groups.get(role) || [];
    for (const asset of group) {
      result.push({ ...asset, position });
      position++;
    }
  }

  return result;
}
