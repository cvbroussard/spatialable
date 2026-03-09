import { createHash } from 'crypto';
import sql from '@/lib/db';
import type { Subscription, StyleProfile } from '@/lib/types';

// ---------------------------------------------------------------------------
// Token hashing — SHA-256 for fast indexed lookup
// ---------------------------------------------------------------------------

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ---------------------------------------------------------------------------
// In-memory cache (5-minute TTL)
// ---------------------------------------------------------------------------

interface CachedSubscription {
  subscription: Subscription;
  style_profile: StyleProfile | null;
  cached_at: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, CachedSubscription>();

function getCached(tokenHash: string): CachedSubscription | null {
  const entry = cache.get(tokenHash);
  if (!entry) return null;
  if (Date.now() - entry.cached_at > CACHE_TTL_MS) {
    cache.delete(tokenHash);
    return null;
  }
  return entry;
}

function setCache(tokenHash: string, subscription: Subscription, styleProfile: StyleProfile | null) {
  cache.set(tokenHash, {
    subscription,
    style_profile: styleProfile,
    cached_at: Date.now(),
  });
}

export function invalidateTokenCache(tokenHash?: string) {
  if (tokenHash) {
    cache.delete(tokenHash);
  } else {
    cache.clear();
  }
}

// ---------------------------------------------------------------------------
// Token validation
// ---------------------------------------------------------------------------

export interface ValidatedSubscription {
  subscription: Subscription;
  style_profile: StyleProfile | null;
}

export async function validateToken(token: string): Promise<ValidatedSubscription | null> {
  if (!token || !token.startsWith('sk_')) return null;

  const tokenHash = hashToken(token);

  // Check cache first
  const cached = getCached(tokenHash);
  if (cached) {
    return {
      subscription: cached.subscription,
      style_profile: cached.style_profile,
    };
  }

  try {
    const rows = await sql`
      SELECT
        s.*,
        sp.id AS sp_id, sp.name AS sp_name,
        sp.primary_color, sp.secondary_color, sp.accent_color,
        sp.font_family, sp.font_url, sp.border_radius,
        sp.background_color, sp.text_color, sp.custom_vars
      FROM subscriptions s
      LEFT JOIN style_profiles sp ON s.style_profile_id = sp.id
      WHERE s.token_hash = ${tokenHash}
        AND s.is_active = true
    `;

    if (rows.length === 0) return null;

    const row = rows[0];

    // Check expiry
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return null;
    }

    const subscription: Subscription = {
      id: row.id,
      client_id: row.client_id,
      token_prefix: row.token_prefix,
      token_hash: row.token_hash,
      tier: row.tier,
      domain_whitelist: row.domain_whitelist || [],
      style_profile_id: row.style_profile_id,
      is_active: row.is_active,
      impression_limit: row.impression_limit,
      impressions_used: row.impressions_used,
      billing_period_start: row.billing_period_start,
      created_at: row.created_at,
      updated_at: row.updated_at,
      expires_at: row.expires_at,
    };

    const styleProfile: StyleProfile | null = row.sp_id ? {
      id: row.sp_id,
      name: row.sp_name,
      primary_color: row.primary_color,
      secondary_color: row.secondary_color,
      accent_color: row.accent_color,
      font_family: row.font_family,
      font_url: row.font_url,
      border_radius: row.border_radius,
      background_color: row.background_color,
      text_color: row.text_color,
      custom_vars: row.custom_vars || {},
      created_at: row.created_at,
      updated_at: row.updated_at,
    } : null;

    setCache(tokenHash, subscription, styleProfile);

    return { subscription, style_profile: styleProfile };
  } catch (err) {
    console.error('[embed/auth] Token validation failed:', err);
    return null;
  }
}
