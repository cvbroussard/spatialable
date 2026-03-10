import { escapeHtml } from './utils';

export interface SeoPayload {
  thumbnail: string | null;
  alt: string;
  jsonLd: Record<string, any>;
}

/**
 * Build the SEO payload for a resolved product.
 * This gets base64-encoded into the X-SA-SEO response header.
 * The client injects it into Light DOM for crawlers.
 */
export function buildSeoPayload(
  assets: Array<{ id: string | number; alt: string; content_type: string }>,
  productRef: string,
  thumbnailUrl: string | null,
): SeoPayload {
  const primaryAlt = assets[0]?.alt || `Product ${productRef}`;

  return {
    thumbnail: thumbnailUrl,
    alt: primaryAlt,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: primaryAlt,
      image: thumbnailUrl || undefined,
    },
  };
}

/**
 * Encode an SEO payload for the X-SA-SEO response header.
 */
export function encodeSeoHeader(payload: SeoPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}
