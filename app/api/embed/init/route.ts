import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/lib/embed/auth';
import { validateOrigin, corsHeaders, originDenied } from '@/lib/embed/cors';

export const dynamic = 'force-dynamic';

/**
 * POST /api/embed/init — Token validation + subscription config.
 *
 * Called once per page load by the loader.js runtime.
 * Returns subscription tier, style profile, and config.
 *
 * Body: { token: "sk_live_xxx" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const result = await validateToken(token);
    if (!result) {
      return NextResponse.json({ valid: false, error: 'Invalid or expired token' }, { status: 401 });
    }

    const { subscription, style_profile } = result;

    // Domain check
    const origin = request.headers.get('Origin');
    const matched = validateOrigin(origin, subscription.domain_whitelist);
    if (!matched) {
      return originDenied();
    }

    // Tier → allowed product types
    const tierTypes: Record<string, string[]> = {
      base: ['hero'],
      standard: ['hero', 'gallery'],
      premium: ['hero', 'gallery', 'configurator'],
    };

    const impressionRemaining = subscription.impression_limit
      ? Math.max(0, subscription.impression_limit - subscription.impressions_used)
      : null;

    const response = NextResponse.json({
      valid: true,
      tier: subscription.tier,
      style_profile: style_profile ? {
        primary_color: style_profile.primary_color,
        secondary_color: style_profile.secondary_color,
        accent_color: style_profile.accent_color,
        font_family: style_profile.font_family,
        font_url: style_profile.font_url,
        border_radius: style_profile.border_radius,
        background_color: style_profile.background_color,
        text_color: style_profile.text_color,
        custom_vars: style_profile.custom_vars,
      } : null,
      config: {
        allowed_types: tierTypes[subscription.tier] || ['hero'],
        impression_remaining: impressionRemaining,
      },
    });

    // Set CORS headers
    const headers = corsHeaders(matched);
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }

    return response;
  } catch (error) {
    console.error('[embed/init] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * OPTIONS /api/embed/init — CORS preflight.
 */
export async function OPTIONS(request: NextRequest) {
  // For preflight, we can't validate the token yet.
  // Allow all origins for preflight — the POST handler does the real check.
  const origin = request.headers.get('Origin');
  if (!origin) {
    return new NextResponse(null, { status: 204 });
  }

  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}
