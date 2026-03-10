import sql from '@/lib/db';
import { generateSignedUrl, extractKeyFromUrl } from '@/lib/embed/signed-url';
import { ensureThumbnail } from '@/lib/embed/thumbnail';
import { looksLikeGtin, normalizeGtin } from '@/lib/gtin';

const SIGNED_URL_TTL = 3600;

async function signUrl(cdnUrl: string | null): Promise<string | null> {
  if (!cdnUrl) return null;
  const key = extractKeyFromUrl(cdnUrl);
  if (!key) return cdnUrl;
  return generateSignedUrl(key, SIGNED_URL_TTL);
}

function inferContentType(url: string): string {
  if (url.includes('.glb') || url.includes('gltf')) return 'model/gltf-binary';
  if (url.includes('.mp4')) return 'video/mp4';
  if (url.includes('.webm')) return 'video/webm';
  if (url.includes('.png')) return 'image/png';
  if (url.includes('.webp')) return 'image/webp';
  return 'image/jpeg';
}

export interface ResolvedPdpAsset {
  id: string;
  url: string;
  content_type: string;
  alt: string;
}

export interface PdpPackage {
  assets: ResolvedPdpAsset[];
  thumbnailUrl: string | null;
}

/**
 * Resolve assets for a PDP render package.
 *
 * Resolution chain:
 * 1. product_ref_map: client_id + external_ref → canonical_ref
 * 2. Fall back to using productRef directly
 * 3. Query product_assets (curated, ordered by position)
 * 4. Fall back to assets table (by UPC / manufacturer_sku / UUID)
 */
export async function resolvePdpAssets(params: {
  productRef: string;
  productType: string;
  clientId: string;
}): Promise<PdpPackage> {
  const { productRef, productType, clientId } = params;

  // Normalize GTIN if input looks like one (8, 12, 13, or 14 digits)
  const normalizedGtin = looksLikeGtin(productRef) ? normalizeGtin(productRef) : null;

  // Step 1: Check product_ref_map for canonical reference
  let canonicalRef = productRef;
  const refCandidates = normalizedGtin && normalizedGtin !== productRef
    ? [productRef, normalizedGtin]
    : [productRef];

  const mapRows = await sql`
    SELECT canonical_ref FROM product_ref_map
    WHERE client_id = ${clientId} AND external_ref = ANY(${refCandidates})
    LIMIT 1
  `;
  if (mapRows.length > 0) {
    canonicalRef = mapRows[0].canonical_ref;
  } else if (normalizedGtin) {
    canonicalRef = normalizedGtin;
  }

  // Step 2: Try curated product_assets
  const curatedRows = await sql`
    SELECT id, asset_id, url, content_type, alt, role, position, thumbnail_url
    FROM product_assets
    WHERE product_ref = ${canonicalRef}
    ORDER BY position ASC
  `;

  if (curatedRows.length > 0) {
    let filtered = curatedRows;

    if (productType === 'hero') {
      filtered = curatedRows.filter((r: any) => r.position === 0).slice(0, 1);
    } else if (productType === 'configurator') {
      filtered = curatedRows.filter((r: any) => r.role === 'model');
    }
    // gallery = all rows in position order

    const assets: ResolvedPdpAsset[] = [];
    for (const row of filtered) {
      const url = await signUrl(row.url);
      if (url) {
        assets.push({
          id: row.asset_id || String(row.id),
          url,
          content_type: row.content_type || inferContentType(row.url),
          alt: row.alt || 'Product',
        });
      }
    }

    // Get thumbnail from hero row
    const heroRow = curatedRows.find((r: any) => r.position === 0);
    let thumbnailUrl: string | null = null;
    if (heroRow) {
      thumbnailUrl = await ensureThumbnail(
        canonicalRef,
        heroRow.url,
        heroRow.thumbnail_url,
        heroRow.id,
      );
    }

    return { assets, thumbnailUrl };
  }

  // Step 3: Fall back to assets table (GTIN-first, then upc/sku/id)
  const assetRows = await sql`
    SELECT id, glb_url, thumbnail_url, category_path, tags
    FROM assets
    WHERE (gtin = ${canonicalRef} OR upc = ${canonicalRef} OR manufacturer_sku = ${canonicalRef} OR id::text = ${canonicalRef})
      AND status = 'approved'
    ORDER BY
      CASE WHEN gtin = ${canonicalRef} THEN 0 ELSE 1 END,
      created_at DESC
  `;

  const assets: ResolvedPdpAsset[] = [];

  if (productType === 'hero') {
    const asset = assetRows[0];
    if (asset) {
      const url = await signUrl(asset.thumbnail_url || asset.glb_url);
      if (url) {
        assets.push({
          id: asset.id,
          url,
          content_type: inferContentType(url),
          alt: asset.category_path || 'Product',
        });
      }
    }
  } else if (productType === 'gallery' || productType === 'configurator') {
    for (const asset of assetRows) {
      if (asset.thumbnail_url) {
        const url = await signUrl(asset.thumbnail_url);
        if (url) {
          assets.push({
            id: asset.id,
            url,
            content_type: inferContentType(asset.thumbnail_url),
            alt: asset.category_path || 'Product',
          });
        }
      }
      if (asset.glb_url) {
        const url = await signUrl(asset.glb_url);
        if (url) {
          assets.push({
            id: asset.id,
            url,
            content_type: 'model/gltf-binary',
            alt: `${asset.category_path || 'Product'} 3D`,
          });
        }
      }
    }
  }

  return { assets, thumbnailUrl: null };
}
