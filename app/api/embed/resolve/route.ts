import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { validateToken } from '@/lib/embed/auth';
import { validateOrigin, corsHeaders, originDenied } from '@/lib/embed/cors';
import { resolvePdpAssets } from '@/lib/embed/resolve-pdp';
import { resolveHomePage } from '@/lib/embed/resolve-home';
import { resolveCollectionPage } from '@/lib/embed/resolve-collection';
import { renderPdpHtml } from '@/lib/embed/templates/pdp';
import { renderHomeHtml } from '@/lib/embed/templates/home';
import { renderCollectionHtml } from '@/lib/embed/templates/collection';
import { buildSeoPayload, encodeSeoHeader } from '@/lib/embed/templates/seo';

export const dynamic = 'force-dynamic';

const SIGNED_URL_TTL = 3600; // 1 hour

/**
 * Apply CORS + custom embed headers to a response.
 */
function applyHeaders(
  response: NextResponse,
  origin: string,
  extra?: Record<string, string>,
): NextResponse {
  for (const [key, value] of Object.entries(corsHeaders(origin))) {
    response.headers.set(key, value);
  }
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      response.headers.set(key, value);
    }
  }
  return response;
}

/**
 * Build an HTML response with embed headers.
 */
function htmlResponse(
  html: string,
  origin: string,
  headers: Record<string, string>,
): NextResponse {
  const response = new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
  return applyHeaders(response, origin, headers);
}

/**
 * Track a page-level impression (fire-and-forget).
 */
function trackImpression(subscriptionId: string) {
  sql`
    UPDATE subscriptions
    SET impressions_used = impressions_used + 1, updated_at = NOW()
    WHERE id = ${subscriptionId}
  `.catch((err: any) => console.error('[embed/resolve] Impression tracking failed:', err));
}

/**
 * Track asset usage (fire-and-forget).
 */
function trackAssetUsage(assetId: string, clientId: string, productRef: string) {
  sql`
    INSERT INTO asset_usage (asset_id, client_id, product_reference)
    VALUES (${assetId}, ${clientId}, ${productRef})
    ON CONFLICT (asset_id, client_id, product_reference) DO UPDATE
    SET last_accessed_at = NOW(), access_count = asset_usage.access_count + 1
  `.catch((err: any) => console.error('[embed/resolve] Asset usage tracking failed:', err));
}

/**
 * GET /api/embed/resolve — Resolve assets and return server-rendered HTML.
 *
 * PDP:        ?token=xxx&product-ref=UPC123&product-type=hero
 * Home page:  ?token=xxx&page-type=home
 * Collection: ?token=xxx&collection-ref=furniture/seating/sofas
 *
 * Response:
 *   Content-Type: text/html; charset=utf-8
 *   X-SA-SEO: base64({ thumbnail, alt, jsonLd })
 *   X-SA-Assets: base64([{ id, type }])
 *   X-SA-Tier: base|standard|premium
 *   X-SA-Expires: 3600
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const productRef = searchParams.get('product-ref') || searchParams.get('product-id');
    const productType = searchParams.get('product-type') || 'hero';
    const pageType = searchParams.get('page-type');
    const collectionRef = searchParams.get('collection-ref');

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    if (!productRef && !pageType && !collectionRef) {
      return NextResponse.json(
        { error: 'One of product-ref, page-type, or collection-ref is required' },
        { status: 400 },
      );
    }

    // Validate token
    const result = await validateToken(token);
    if (!result) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const { subscription, style_profile } = result;

    // Domain check
    const origin = request.headers.get('Origin');
    const matched = validateOrigin(origin, subscription.domain_whitelist);
    if (!matched) {
      return originDenied();
    }

    // ── Home page ──────────────────────────────────────────────────────
    if (pageType === 'home') {
      const featuredRef = searchParams.get('featured-collection') || undefined;
      const homePackage = await resolveHomePage(featuredRef);
      const html = renderHomeHtml(homePackage, style_profile);

      trackImpression(subscription.id);

      return htmlResponse(html, matched, {
        'X-SA-Tier': subscription.tier,
        'X-SA-Expires': String(SIGNED_URL_TTL),
      });
    }

    // ── Collection page ────────────────────────────────────────────────
    if (collectionRef) {
      const collectionPackage = await resolveCollectionPage(collectionRef);
      const html = renderCollectionHtml(collectionPackage, style_profile);

      trackImpression(subscription.id);

      return htmlResponse(html, matched, {
        'X-SA-Tier': subscription.tier,
        'X-SA-Expires': String(SIGNED_URL_TTL),
      });
    }

    // ── PDP ────────────────────────────────────────────────────────────

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

    // Resolve PDP assets (handles product_ref_map + curated + fallback)
    const pdpPackage = await resolvePdpAssets({
      productRef: productRef!,
      productType,
      clientId: subscription.client_id,
    });

    if (pdpPackage.assets.length === 0) {
      // Empty response — slot fallback shows through
      const html = renderPdpHtml([], style_profile, subscription.tier);
      return htmlResponse(html, matched, {
        'X-SA-Tier': subscription.tier,
        'X-SA-Expires': String(SIGNED_URL_TTL),
      });
    }

    // Render HTML
    const html = renderPdpHtml(pdpPackage.assets, style_profile, subscription.tier);

    // Build SEO payload
    const seoPayload = buildSeoPayload(pdpPackage.assets, productRef!, pdpPackage.thumbnailUrl);
    const seoHeader = encodeSeoHeader(seoPayload);

    // Build asset manifest for client-side impression tracking
    const assetManifest = pdpPackage.assets.map((a) => ({
      id: a.id,
      type: a.content_type,
    }));
    const assetsHeader = Buffer.from(JSON.stringify(assetManifest)).toString('base64');

    // Track impression + asset usage (fire-and-forget)
    trackImpression(subscription.id);
    trackAssetUsage(pdpPackage.assets[0].id, subscription.client_id, productRef!);

    return htmlResponse(html, matched, {
      'X-SA-SEO': seoHeader,
      'X-SA-Assets': assetsHeader,
      'X-SA-Tier': subscription.tier,
      'X-SA-Expires': String(SIGNED_URL_TTL),
    });
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
