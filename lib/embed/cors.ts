import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// CORS for embed endpoints — domain-locked to subscription whitelist
// ---------------------------------------------------------------------------

const EMBED_CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Expose-Headers': 'X-SA-SEO, X-SA-Assets, X-SA-Tier, X-SA-Expires',
  'Access-Control-Max-Age': '86400',
};

/**
 * Check if an origin matches a domain whitelist entry.
 * Supports wildcards: "*.example.com" matches "shop.example.com".
 */
function originMatchesDomain(origin: string, domain: string): boolean {
  try {
    const originHost = new URL(origin).hostname;

    if (domain.startsWith('*.')) {
      const suffix = domain.slice(2);
      return originHost === suffix || originHost.endsWith(`.${suffix}`);
    }

    return originHost === domain;
  } catch {
    return false;
  }
}

/**
 * Validate origin against domain whitelist.
 * Returns the matched origin string or null.
 */
export function validateOrigin(origin: string | null, domainWhitelist: string[]): string | null {
  if (domainWhitelist.length === 0) return null;

  // Same-origin requests don't send an Origin header.
  // Cross-origin (embed) requests always include Origin.
  // Null origin is safe to accept — it means same-origin or direct navigation.
  if (!origin) {
    if (process.env.NODE_ENV === 'development') return 'http://localhost:3000';
    return 'same-origin';
  }

  // Allow localhost in development
  if (process.env.NODE_ENV === 'development') {
    try {
      const host = new URL(origin).hostname;
      if (host === 'localhost' || host === '127.0.0.1') return origin;
    } catch {
      // ignore
    }
  }

  for (const domain of domainWhitelist) {
    if (originMatchesDomain(origin, domain)) {
      return origin;
    }
  }

  return null;
}

/**
 * Build CORS response headers for a validated origin.
 */
export function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    ...EMBED_CORS_HEADERS,
  };
}

/**
 * Handle OPTIONS preflight for embed endpoints.
 */
export function handlePreflight(request: Request, domainWhitelist: string[]): NextResponse | null {
  if (request.method !== 'OPTIONS') return null;

  const origin = request.headers.get('Origin');
  const matched = validateOrigin(origin, domainWhitelist);

  if (!matched) {
    return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
  }

  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(matched),
  });
}

/**
 * Create a 403 response for domain mismatch.
 */
export function originDenied(): NextResponse {
  return NextResponse.json(
    { error: 'Origin not allowed for this subscription' },
    { status: 403 },
  );
}
