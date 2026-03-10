// ---------------------------------------------------------------------------
// Embed API client — runs in consumer's browser
// ---------------------------------------------------------------------------

import type { ResolveResult, SeoPayload, AssetRef } from './types';

const API_BASE = '__SA_API_BASE__'; // Replaced at build time or set via config

let apiBase = API_BASE;

export function setApiBase(base: string) {
  apiBase = base.replace(/\/$/, '');
}

export function getApiBase(): string {
  return apiBase;
}

/**
 * GET /api/embed/resolve — Fetch server-rendered HTML + metadata headers.
 */
export async function resolveAsset(params: {
  token: string;
  productRef?: string;
  productType?: string;
  pageType?: string;
  collectionRef?: string;
  featuredCollection?: string;
  signal?: AbortSignal;
}): Promise<ResolveResult> {
  const query = new URLSearchParams();
  query.set('token', params.token);
  if (params.productRef) query.set('product-ref', params.productRef);
  if (params.productType) query.set('product-type', params.productType);
  if (params.pageType) query.set('page-type', params.pageType);
  if (params.collectionRef) query.set('collection-ref', params.collectionRef);
  if (params.featuredCollection) query.set('featured-collection', params.featuredCollection);

  const res = await fetch(`${apiBase}/api/embed/resolve?${query}`, {
    signal: params.signal,
  });

  if (!res.ok) {
    return { html: '', seo: null, assets: [], tier: '', expiresIn: 0 };
  }

  const html = await res.text();

  // Parse custom headers
  let seo: SeoPayload | null = null;
  const seoHeader = res.headers.get('X-SA-SEO');
  if (seoHeader) {
    try {
      seo = JSON.parse(atob(seoHeader));
    } catch { /* ignore */ }
  }

  let assets: AssetRef[] = [];
  const assetsHeader = res.headers.get('X-SA-Assets');
  if (assetsHeader) {
    try {
      assets = JSON.parse(atob(assetsHeader));
    } catch { /* ignore */ }
  }

  const tier = res.headers.get('X-SA-Tier') || '';
  const expiresIn = parseInt(res.headers.get('X-SA-Expires') || '3600', 10);

  return { html, seo, assets, tier, expiresIn };
}

/**
 * POST /api/embed/impression — Batch impression beacon.
 */
export async function reportImpressions(token: string, events: Array<{ asset_id: string; product_ref?: string; type?: string }>) {
  const payload = JSON.stringify({ token, events });
  const url = `${apiBase}/api/embed/impression`;

  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
  } else {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }
}
