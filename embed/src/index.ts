// ---------------------------------------------------------------------------
// SpatialAble Embed Loader
//
// Entry point for the <sa-media> web component.
// Include this script on any page to enable SpatialAble media delivery.
//
// Usage:
//   <script src="https://cdn.spatialable.com/embed/loader.js"></script>
//   <sa-media token="sk_live_xxx" asset="lifestyle-hero-01"></sa-media>
//   <sa-media token="sk_live_xxx" product-id="UPC123" product-type="gallery"></sa-media>
// ---------------------------------------------------------------------------

import { SaMedia } from './sa-media';
import { setApiBase } from './api-client';

// Auto-detect API base from script src
(function () {
  // Try to detect from the script tag's src
  const scripts = document.querySelectorAll('script[src*="loader"]');
  for (const script of scripts) {
    const src = (script as HTMLScriptElement).src;
    if (src.includes('spatialable') || src.includes('sa-media') || src.includes('loader')) {
      try {
        const url = new URL(src);
        // If served from CDN, API base is the main domain
        // For dev, it's the same origin
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
          setApiBase(url.origin);
        }
      } catch {
        // ignore
      }
      break;
    }
  }

  // Also check for a global config
  if (typeof (window as any).__SA_CONFIG__ === 'object') {
    const config = (window as any).__SA_CONFIG__;
    if (config.apiBase) setApiBase(config.apiBase);
  }
})();

// Register the custom element
if (!customElements.get('sa-media')) {
  customElements.define('sa-media', SaMedia);
}

// Export for programmatic use
(window as any).SpatialAble = {
  version: '0.1.0',
  setApiBase,
};
