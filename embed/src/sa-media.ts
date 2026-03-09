// ---------------------------------------------------------------------------
// <sa-media> Custom Element — core component
//
// A piracy-protected media renderer with closed Shadow DOM.
// Authenticates via subscription token, loads style profiles,
// resolves assets via signed URLs, renders into an isolated shadow tree.
// ---------------------------------------------------------------------------

import { initSubscription, resolveAsset, reportImpressions, setApiBase, getApiBase } from './api-client';
import { BASE_STYLES, buildStyleVars } from './styles';
import { renderHero } from './renderers/hero';
import { renderGallery } from './renderers/gallery';
import type { InitResponse, ResolveResponse, StyleProfile } from './types';

// ---------------------------------------------------------------------------
// Module-level caches (shared across all <sa-media> instances)
// ---------------------------------------------------------------------------

interface CachedInit {
  data: InitResponse;
  cached_at: number;
}

const INIT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const initCache = new Map<string, CachedInit>();
const initPromises = new Map<string, Promise<InitResponse>>();

// Impression batch queue
let impressionQueue: Array<{ asset_id: string; product_ref?: string; type?: string }> = [];
let impressionToken: string = '';
let impressionTimer: ReturnType<typeof setTimeout> | null = null;

function queueImpression(token: string, assetId: string, productRef?: string, type?: string) {
  impressionToken = token;
  impressionQueue.push({ asset_id: assetId, product_ref: productRef, type });

  if (!impressionTimer) {
    impressionTimer = setTimeout(flushImpressions, 5000);
  }
}

function flushImpressions() {
  if (impressionQueue.length > 0 && impressionToken) {
    reportImpressions(impressionToken, [...impressionQueue]);
    impressionQueue = [];
  }
  impressionTimer = null;
}

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushImpressions);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushImpressions();
  });
}

/**
 * Get init data for a token (cached, deduped).
 */
async function getInit(token: string): Promise<InitResponse> {
  const cached = initCache.get(token);
  if (cached && Date.now() - cached.cached_at < INIT_CACHE_TTL) {
    return cached.data;
  }

  // Deduplicate concurrent init requests
  const pending = initPromises.get(token);
  if (pending) return pending;

  const promise = initSubscription(token).then((data) => {
    initPromises.delete(token);
    if (data.valid) {
      initCache.set(token, { data, cached_at: Date.now() });
    }
    return data;
  }).catch((err) => {
    initPromises.delete(token);
    return { valid: false, tier: '', style_profile: null, config: { allowed_types: [], impression_remaining: null }, error: String(err) } as InitResponse;
  });

  initPromises.set(token, promise);
  return promise;
}

// ---------------------------------------------------------------------------
// <sa-media> Custom Element
// ---------------------------------------------------------------------------

export class SaMedia extends HTMLElement {
  static observedAttributes = ['token', 'asset', 'product-id', 'product-type', 'api-base'];

  #shadow: ShadowRoot;
  #container: HTMLElement;
  #styleEl: HTMLStyleElement;
  #resolved = false;
  #abortController: AbortController | null = null;
  #observer: IntersectionObserver | null = null;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'closed' });

    // Base stylesheet
    this.#styleEl = document.createElement('style');
    this.#styleEl.textContent = BASE_STYLES;
    this.#shadow.appendChild(this.#styleEl);

    // Content container
    this.#container = document.createElement('div');
    this.#container.className = 'sa-container';
    this.#shadow.appendChild(this.#container);
  }

  connectedCallback() {
    // Show loading state
    this.#container.innerHTML = '<div class="sa-loading"></div>';

    // Set up lazy loading via IntersectionObserver
    this.#observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !this.#resolved) {
            this.#resolve();
            this.#observer?.unobserve(this);
          }
        }
      },
      { rootMargin: '200px' },
    );
    this.#observer.observe(this);
  }

  disconnectedCallback() {
    this.#observer?.disconnect();
    this.#observer = null;
    this.#abortController?.abort();
    this.#abortController = null;
  }

  attributeChangedCallback(name: string, _old: string | null, _val: string | null) {
    if (name === 'api-base' && _val) {
      setApiBase(_val);
    }
    // Re-resolve if attributes change after initial render
    if (this.#resolved && (name === 'asset' || name === 'product-id' || name === 'product-type')) {
      this.#resolved = false;
      this.#resolve();
    }
  }

  async #resolve() {
    const token = this.getAttribute('token');
    if (!token) {
      this.#renderError('Missing token');
      return;
    }

    // Check for api-base override
    const apiBaseAttr = this.getAttribute('api-base');
    if (apiBaseAttr) {
      setApiBase(apiBaseAttr);
    }

    this.#abortController?.abort();
    this.#abortController = new AbortController();

    try {
      // 1. Init (validates token, gets style profile)
      const init = await getInit(token);
      if (!init.valid) {
        this.#renderError(init.error || 'Invalid subscription');
        return;
      }

      // 2. Apply style profile
      if (init.style_profile) {
        this.#applyStyleProfile(init.style_profile);
      }

      // Load custom font if specified
      if (init.style_profile?.font_url) {
        this.#loadFont(init.style_profile.font_url);
      }

      // 3. Resolve assets
      const asset = this.getAttribute('asset');
      const productId = this.getAttribute('product-id');
      const productType = this.getAttribute('product-type') || 'hero';

      const resolve = await resolveAsset({
        token,
        asset: asset || undefined,
        productId: productId || undefined,
        productType: productType,
      });

      if (!resolve.resolved || resolve.assets.length === 0) {
        this.#renderError('No media found');
        return;
      }

      this.#resolved = true;

      // 4. Render
      if (productType === 'gallery' && resolve.assets.length > 1) {
        await renderGallery(this.#container, resolve.assets);
      } else {
        this.#container.innerHTML = '';
        await renderHero(this.#container, resolve.assets[0]);
      }

      // 5. Queue impression
      const primaryAsset = resolve.assets[0];
      queueImpression(token, primaryAsset.id, productId || asset || undefined, productType);

    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      this.#renderError('Failed to load media');
      console.error('[sa-media]', err);
    }
  }

  #applyStyleProfile(profile: StyleProfile) {
    const vars = buildStyleVars(profile);
    if (vars) {
      this.#styleEl.textContent = BASE_STYLES + `\n:host { ${vars} }`;
    }
  }

  #loadFont(fontUrl: string) {
    // Inject font link into document head (outside shadow DOM — fonts are global)
    if (!document.querySelector(`link[href="${fontUrl}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = fontUrl;
      document.head.appendChild(link);
    }
  }

  #renderError(message: string) {
    this.#container.innerHTML = `<div class="sa-error">${message}</div>`;
  }
}
