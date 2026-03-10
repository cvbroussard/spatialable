import type { StyleProfile } from '@/lib/types';
import { renderStyleBlock } from './styles';
import { escapeHtml } from './utils';

interface RenderableAsset {
  id: string | number;
  url: string;
  content_type: string;
  alt: string;
}

/**
 * Render PDP Shadow DOM HTML with style profile baked in.
 *
 * Media elements use data-sa-src instead of src — the client hydration
 * step fetches them as blobs for anti-piracy protection.
 *
 * @param assets - Resolved assets with signed URLs
 * @param styleProfile - Subscription style profile (baked into CSS)
 * @param tier - Subscription tier (determines gallery vs hero-only)
 */
export function renderPdpHtml(
  assets: RenderableAsset[],
  styleProfile: StyleProfile | null,
  tier: string,
): string {
  const styles = renderStyleBlock(styleProfile);

  if (assets.length === 0) {
    return `${styles}
<div class="sa-container">
  <slot></slot>
</div>`;
  }

  const showGallery = tier !== 'base' && assets.length > 1;

  if (showGallery) {
    return `${styles}
<div class="sa-container">
  <div class="sa-gallery">
    <div class="sa-gallery-main">
      ${renderMediaElement(assets[0])}
    </div>
    <div class="sa-gallery-thumbs">
      ${assets.map((asset, i) => renderThumbnail(asset, i)).join('\n      ')}
    </div>
  </div>
  <slot></slot>
</div>`;
  }

  // Hero-only (single asset or base tier)
  return `${styles}
<div class="sa-container">
  ${renderMediaElement(assets[0])}
  <slot></slot>
</div>`;
}

function renderMediaElement(asset: RenderableAsset): string {
  const alt = escapeHtml(String(asset.alt || 'Product'));
  const id = escapeHtml(String(asset.id));

  if (asset.content_type === 'model/gltf-binary') {
    return `<div class="sa-viewer" data-sa-src="${escapeHtml(asset.url)}" data-sa-type="model/gltf-binary" data-sa-id="${id}" data-sa-alt="${alt}"></div>`;
  }

  if (asset.content_type.startsWith('video/')) {
    return `<video class="sa-video" data-sa-src="${escapeHtml(asset.url)}" data-sa-type="${escapeHtml(asset.content_type)}" data-sa-id="${id}" muted loop playsinline></video>`;
  }

  // Default: image
  return `<img class="sa-image" data-sa-src="${escapeHtml(asset.url)}" data-sa-type="${escapeHtml(asset.content_type)}" data-sa-id="${id}" alt="${alt}" draggable="false" src="">`;
}

function renderThumbnail(asset: RenderableAsset, index: number): string {
  const activeClass = index === 0 ? ' active' : '';

  if (asset.content_type === 'model/gltf-binary') {
    return `<div class="sa-gallery-thumb sa-gallery-thumb-3d${activeClass}" data-sa-index="${index}" data-sa-src="${escapeHtml(asset.url)}" data-sa-type="model/gltf-binary" data-sa-id="${escapeHtml(String(asset.id))}">3D</div>`;
  }

  return `<div class="sa-gallery-thumb${activeClass}" data-sa-index="${index}" data-sa-id="${escapeHtml(String(asset.id))}">
    <img data-sa-thumb="${escapeHtml(asset.url)}" alt="${escapeHtml(String(asset.alt || 'Thumbnail'))}" draggable="false" src="">
  </div>`;
}
