import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { validateToken } from '@/lib/embed/auth';
import { validateOrigin, corsHeaders, originDenied } from '@/lib/embed/cors';
import { generateSignedUrl, extractKeyFromUrl } from '@/lib/embed/signed-url';

export const dynamic = 'force-dynamic';

const SIGNED_URL_TTL = 3600; // 1 hour

/**
 * Sign a CDN URL — extract key, generate presigned URL.
 * Returns original URL if key extraction fails (e.g., external URL).
 */
async function signUrl(cdnUrl: string | null): Promise<string | null> {
  if (!cdnUrl) return null;
  const key = extractKeyFromUrl(cdnUrl);
  if (!key) return cdnUrl;
  return generateSignedUrl(key, SIGNED_URL_TTL);
}

/**
 * Determine content type from URL.
 */
function inferContentType(url: string): string {
  if (url.includes('.glb') || url.includes('gltf')) return 'model/gltf-binary';
  if (url.includes('.mp4')) return 'video/mp4';
  if (url.includes('.webm')) return 'video/webm';
  if (url.includes('.png')) return 'image/png';
  if (url.includes('.webp')) return 'image/webp';
  return 'image/jpeg';
}

/**
 * GET /api/embed/resolve — Resolve asset(s) and return signed URLs.
 *
 * Static:  ?token=xxx&asset=lifestyle-modern-living-01
 * Dynamic: ?token=xxx&product-id=123&product-type=hero
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const assetRef = searchParams.get('asset');
    const productId = searchParams.get('product-id');
    const productType = searchParams.get('product-type') || 'hero';

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    if (!assetRef && !productId) {
      return NextResponse.json(
        { error: 'Either asset or product-id is required' },
        { status: 400 },
      );
    }

    // Validate token
    const result = await validateToken(token);
    if (!result) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const { subscription } = result;

    // Domain check
    const origin = request.headers.get('Origin');
    const matched = validateOrigin(origin, subscription.domain_whitelist);
    if (!matched) {
      return originDenied();
    }

    // Check tier allows product type
    const tierTypes: Record<string, string[]> = {
      base: ['hero'],
      standard: ['hero', 'gallery'],
      premium: ['hero', 'gallery', 'configurator'],
    };
    const allowed = tierTypes[subscription.tier] || ['hero'];
    if (!allowed.includes(productType)) {
      return NextResponse.json(
        { error: `Product type "${productType}" not available on ${subscription.tier} tier` },
        { status: 403 },
      );
    }

    // Resolve assets
    let assets: any[] = [];

    if (assetRef) {
      // Static mode — look up by ID or a reference key
      // Try UUID first, then search by category_path or tags
      const rows = await sql`
        SELECT id, glb_url, thumbnail_url, category_path, tags
        FROM assets
        WHERE (id::text = ${assetRef} OR category_path = ${assetRef})
          AND status = 'approved'
        LIMIT 1
      `;

      if (rows.length > 0) {
        const asset = rows[0];
        const url = await signUrl(asset.thumbnail_url || asset.glb_url);
        if (url) {
          assets.push({
            id: asset.id,
            url,
            content_type: inferContentType(url),
            alt: asset.category_path || 'Asset',
          });
        }
      }
    } else if (productId) {
      // Dynamic mode — try curated product_assets first, fall back to assets table

      // Primary: curated product set (ordered by editorial position)
      const curatedRows = await sql`
        SELECT asset_id, url, content_type, alt, role, position
        FROM product_assets
        WHERE product_ref = ${productId}
        ORDER BY position ASC
      `;

      if (curatedRows.length > 0) {
        // Curated set exists — slice by product type
        let filtered = curatedRows;

        if (productType === 'hero') {
          filtered = curatedRows.filter((r: any) => r.position === 0).slice(0, 1);
        } else if (productType === 'configurator') {
          filtered = curatedRows.filter((r: any) => r.role === 'model');
        }
        // gallery = all rows in position order (no filter needed)

        for (const row of filtered) {
          const url = await signUrl(row.url);
          if (url) {
            assets.push({
              id: row.asset_id,
              url,
              content_type: row.content_type || inferContentType(row.url),
              alt: row.alt || 'Product',
            });
          }
        }
      } else {
        // Fallback: legacy assets table query (for products not yet curated)
        const rows = await sql`
          SELECT id, glb_url, thumbnail_url, category_path, tags
          FROM assets
          WHERE (upc = ${productId} OR manufacturer_sku = ${productId} OR id::text = ${productId})
            AND status = 'approved'
          ORDER BY created_at DESC
        `;

        if (productType === 'hero') {
          const asset = rows[0];
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
        } else if (productType === 'gallery') {
          for (const asset of rows) {
            if (asset.thumbnail_url) {
              const url = await signUrl(asset.thumbnail_url);
              if (url) {
                assets.push({
                  id: asset.id,
                  url,
                  content_type: inferContentType(asset.thumbnail_url),
                  alt: asset.category_path || 'Product',
                  media_type: 'image',
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
                  media_type: '3d',
                });
              }
            }
          }
        }
      }
    }

    if (assets.length === 0) {
      return NextResponse.json({ type: productType, assets: [], resolved: false }, { status: 404 });
    }

    // Track impression
    const assetId = assets[0]?.id;
    if (assetId) {
      const productRef = productId || assetRef;
      // Increment subscription impressions
      await sql`
        UPDATE subscriptions
        SET impressions_used = impressions_used + 1, updated_at = NOW()
        WHERE id = ${subscription.id}
      `;
      // Track asset usage
      await sql`
        INSERT INTO asset_usage (asset_id, client_id, product_reference)
        VALUES (${assetId}, ${subscription.client_id}, ${productRef})
        ON CONFLICT (asset_id, client_id, product_reference) DO UPDATE
        SET last_accessed_at = NOW(), access_count = asset_usage.access_count + 1
      `;
    }

    const response = NextResponse.json({
      type: productType,
      assets,
      resolved: true,
      expires_in: SIGNED_URL_TTL,
    });

    const headers = corsHeaders(matched);
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }

    return response;
  } catch (error) {
    console.error('[embed/resolve] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * OPTIONS /api/embed/resolve — CORS preflight.
 */
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('Origin');
  if (!origin) return new NextResponse(null, { status: 204 });
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}
