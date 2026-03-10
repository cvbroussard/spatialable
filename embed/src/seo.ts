// ---------------------------------------------------------------------------
// Light DOM SEO injection
//
// Injects a visually-hidden 200x200 thumbnail and JSON-LD structured data
// into the Light DOM for search engine crawlers. Shadow DOM content is not
// reliably indexed, so critical SEO signals live in the Light DOM.
// ---------------------------------------------------------------------------

export interface SeoPayload {
  thumbnail: string | null;
  alt: string;
  jsonLd: Record<string, any>;
}

/**
 * Parse the X-SA-SEO response header into a SeoPayload.
 */
export function parseSeoHeader(headerValue: string | null): SeoPayload | null {
  if (!headerValue) return null;

  try {
    return JSON.parse(atob(headerValue));
  } catch {
    return null;
  }
}

/**
 * Inject SEO content into the Light DOM of the host element.
 *
 * Creates:
 * - A visually-hidden <img> with the 200x200 thumbnail (crawler-visible)
 * - A JSON-LD <script> with Product.image structured data
 */
export function injectSeoContent(hostElement: HTMLElement, payload: SeoPayload): void {
  // Remove any previously injected SEO content
  const existing = hostElement.querySelectorAll('[data-sa-seo]');
  existing.forEach((el) => el.remove());

  // Thumbnail image — visually hidden but present in DOM for crawlers
  if (payload.thumbnail) {
    const img = document.createElement('img');
    img.src = payload.thumbnail;
    img.alt = payload.alt;
    img.width = 200;
    img.height = 200;
    img.setAttribute('data-sa-seo', 'thumbnail');
    img.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
    hostElement.appendChild(img);
  }

  // JSON-LD structured data
  if (payload.jsonLd) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-sa-seo', 'jsonld');
    script.textContent = JSON.stringify(payload.jsonLd);
    hostElement.appendChild(script);
  }
}
