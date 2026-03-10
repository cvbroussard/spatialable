import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAuth } from '@/lib/auth/api-key';
import { normalizeGtin, looksLikeGtin } from '@/lib/gtin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/assets/match — Find a matching asset by GTIN, UPC, SKU, or category.
 *
 * Priority: GTIN → UPC → SKU → category/form_factor match.
 *
 * Query params:
 *   ?gtin=00012345678905   (or any GTIN-8/12/13/14 — auto-normalized)
 *   ?upc=012345678901
 *   ?sku=MFG-SKU-001
 *   ?category=furniture/seating/sofa
 */
export async function GET(request: NextRequest) {
  try {
    const guard = await requireAuth(request);
    if (!guard.ok) return guard.response;

    const { searchParams } = new URL(request.url);
    const gtinParam = searchParams.get('gtin');
    const upc = searchParams.get('upc');
    const sku = searchParams.get('sku');
    const category = searchParams.get('category');

    if (!gtinParam && !upc && !sku && !category) {
      return NextResponse.json(
        { error: 'At least one of gtin, upc, sku, or category is required' },
        { status: 400 },
      );
    }

    // Try GTIN match first (normalize input)
    const gtinInput = gtinParam || (upc && looksLikeGtin(upc) ? upc : null);
    if (gtinInput) {
      const normalized = normalizeGtin(gtinInput);
      if (normalized) {
        const [asset] = await sql`
          SELECT id, specificity, glb_url, thumbnail_url, category_path, attributes, tags
          FROM assets
          WHERE gtin = ${normalized} AND status = 'approved'
          LIMIT 1
        `;
        if (asset) {
          await sql`
            INSERT INTO asset_usage (asset_id, client_id, product_reference)
            VALUES (${asset.id}, ${guard.client.id}, ${normalized})
            ON CONFLICT (asset_id, client_id, product_reference) DO UPDATE
            SET last_accessed_at = NOW(), access_count = asset_usage.access_count + 1
          `;

          return NextResponse.json({
            asset_id: asset.id,
            specificity: asset.specificity,
            glb_url: asset.glb_url,
            thumbnail_url: asset.thumbnail_url,
            match_type: 'gtin',
            match_confidence: 1.0,
          });
        }
      }
    }

    // Try exact UPC match
    if (upc) {
      const [asset] = await sql`
        SELECT id, specificity, glb_url, thumbnail_url, category_path, attributes, tags
        FROM assets
        WHERE upc = ${upc} AND status = 'approved'
        LIMIT 1
      `;
      if (asset) {
        await sql`
          INSERT INTO asset_usage (asset_id, client_id, product_reference)
          VALUES (${asset.id}, ${guard.client.id}, ${upc})
          ON CONFLICT (asset_id, client_id, product_reference) DO UPDATE
          SET last_accessed_at = NOW(), access_count = asset_usage.access_count + 1
        `;

        return NextResponse.json({
          asset_id: asset.id,
          specificity: asset.specificity,
          glb_url: asset.glb_url,
          thumbnail_url: asset.thumbnail_url,
          match_type: 'upc',
          match_confidence: 1.0,
        });
      }
    }

    // Try SKU match
    if (sku) {
      const [asset] = await sql`
        SELECT id, specificity, glb_url, thumbnail_url, category_path, attributes, tags
        FROM assets
        WHERE manufacturer_sku = ${sku} AND status = 'approved'
        LIMIT 1
      `;
      if (asset) {
        await sql`
          INSERT INTO asset_usage (asset_id, client_id, product_reference)
          VALUES (${asset.id}, ${guard.client.id}, ${sku})
          ON CONFLICT (asset_id, client_id, product_reference) DO UPDATE
          SET last_accessed_at = NOW(), access_count = asset_usage.access_count + 1
        `;

        return NextResponse.json({
          asset_id: asset.id,
          specificity: asset.specificity,
          glb_url: asset.glb_url,
          thumbnail_url: asset.thumbnail_url,
          match_type: 'sku',
          match_confidence: 1.0,
        });
      }
    }

    // Try category/form_factor match
    if (category) {
      const [asset] = await sql`
        SELECT a.id, a.specificity, a.glb_url, a.thumbnail_url, a.category_path
        FROM assets a
        WHERE a.category_path = ${category}
          AND a.status = 'approved'
          AND a.specificity = 'form_factor'
        ORDER BY a.created_at DESC
        LIMIT 1
      `;
      if (asset) {
        return NextResponse.json({
          asset_id: asset.id,
          specificity: asset.specificity,
          glb_url: asset.glb_url,
          thumbnail_url: asset.thumbnail_url,
          match_type: 'form_factor',
          match_confidence: 0.7,
        });
      }
    }

    // No match found
    return NextResponse.json({ match: null }, { status: 404 });
  } catch (error) {
    console.error('[assets/match] Error:', error);
    return NextResponse.json(
      { error: 'Failed to match asset' },
      { status: 500 },
    );
  }
}
