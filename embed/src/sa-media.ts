// ---------------------------------------------------------------------------
// <sa-media> Custom Element — thin shell
//
// Fetches server-rendered HTML, mounts into closed Shadow DOM,
// hydrates signed URLs to blob URLs (anti-piracy), injects SEO
// content into Light DOM, and initializes interaction handlers.
// ---------------------------------------------------------------------------

import { resolveAsset, reportImpressions, setApiBase } from './api-client';
import { LOADING_STYLES } from './styles';
import { hydrateShadowDom } from './hydrate';
import { injectSeoContent } from './seo';
import { initGalleryInteractions } from './interactions';

// ---------------------------------------------------------------------------
// Impression batch queue (shared across all <sa-media> instances)
// ---------------------------------------------------------------------------

let impressionQueue: Array<{ asset_id: string; product_ref?: string; type?: string }> = [];
let impressionToken = '';
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

// ---------------------------------------------------------------------------
// <sa-media> Custom Element
// ---------------------------------------------------------------------------

export class SaMedia extends HTMLElement {
  static observedAttributes = [
    'token', 'product-ref', 'product-id', 'product-type',
    'page-type', 'collection-ref', 'api-base',
  ];

  #shadow: ShadowRoot;
  #container: HTMLElement;
  #resolved = false;
  #abortController: AbortController | null = null;
  #observer: IntersectionObserver | null = null;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'closed' });

    // Minimal loading styles (server bakes full styles into HTML)
    const style = document.createElement('style');
    style.textContent = LOADING_STYLES;
    this.#shadow.appendChild(style);

    // Content container
    this.#container = document.createElement('div');
    this.#container.className = 'sa-container';
    this.#shadow.appendChild(this.#container);
  }

  connectedCallback() {
    // Show loading skeleton
    this.#container.innerHTML = '<div class="sa-loading"></div>';

    // Lazy load via IntersectionObserver
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
    // Re-resolve if content attributes change after initial render
    if (this.#resolved && ['product-ref', 'product-id', 'product-type', 'page-type', 'collection-ref'].includes(name)) {
      this.#resolved = false;
      this.#resolve();
    }
  }

  async #resolve() {
    const token = this.getAttribute('token');
    if (!token) return;

    const apiBaseAttr = this.getAttribute('api-base');
    if (apiBaseAttr) setApiBase(apiBaseAttr);

    this.#abortController?.abort();
    this.#abortController = new AbortController();

    try {
      // Single API call — server returns rendered HTML
      const result = await resolveAsset({
        token,
        productRef: this.getAttribute('product-ref') || this.getAttribute('product-id') || undefined,
        productType: this.getAttribute('product-type') || undefined,
        pageType: this.getAttribute('page-type') || undefined,
        collectionRef: this.getAttribute('collection-ref') || undefined,
        signal: this.#abortController.signal,
      });

      if (!result.html) {
        // No assets — leave <slot> visible for retailer fallback
        this.#container.innerHTML = '<slot></slot>';
        return;
      }

      this.#resolved = true;

      // Mount server-rendered HTML into Shadow DOM
      this.#container.innerHTML = result.html;

      // Inject SEO content into Light DOM (hidden thumbnail + JSON-LD)
      if (result.seo) {
        injectSeoContent(this, result.seo);
      }

      // Hydrate: data-sa-src → blob URLs (anti-piracy)
      await hydrateShadowDom(this.#container);

      // Initialize gallery interactions (click/keyboard navigation)
      initGalleryInteractions(this.#container);

      // Queue impressions from asset manifest
      for (const asset of result.assets) {
        queueImpression(
          token,
          asset.id,
          this.getAttribute('product-ref') || this.getAttribute('product-id') || undefined,
          asset.type,
        );
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      // On error, show slot fallback
      this.#container.innerHTML = '<slot></slot>';
      console.error('[sa-media]', err);
    }
  }
}
