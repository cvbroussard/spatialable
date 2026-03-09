// ---------------------------------------------------------------------------
// Embed API client — runs in consumer's browser
// ---------------------------------------------------------------------------

import type { InitResponse, ResolveResponse } from './types';

const API_BASE = '__SA_API_BASE__'; // Replaced at build time or set via config

let apiBase = API_BASE;

export function setApiBase(base: string) {
  apiBase = base.replace(/\/$/, '');
}

export function getApiBase(): string {
  return apiBase;
}

/**
 * POST /api/embed/init — Validate token, get config + style profile.
 */
export async function initSubscription(token: string): Promise<InitResponse> {
  const res = await fetch(`${apiBase}/api/embed/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { valid: false, tier: '', style_profile: null, config: { allowed_types: [], impression_remaining: null }, error: body.error || `HTTP ${res.status}` };
  }

  return res.json();
}

/**
 * GET /api/embed/resolve — Resolve asset(s) for rendering.
 */
export async function resolveAsset(params: {
  token: string;
  asset?: string;
  productId?: string;
  productType?: string;
}): Promise<ResolveResponse> {
  const query = new URLSearchParams();
  query.set('token', params.token);
  if (params.asset) query.set('asset', params.asset);
  if (params.productId) query.set('product-id', params.productId);
  if (params.productType) query.set('product-type', params.productType);

  const res = await fetch(`${apiBase}/api/embed/resolve?${query}`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { type: params.productType || 'hero', assets: [], resolved: false, expires_in: 0, error: body.error || `HTTP ${res.status}` };
  }

  return res.json();
}

/**
 * POST /api/embed/impression — Batch impression beacon.
 */
export async function reportImpressions(token: string, events: Array<{ asset_id: string; product_ref?: string; type?: string }>) {
  // Use sendBeacon for reliability on page unload, fall back to fetch
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
