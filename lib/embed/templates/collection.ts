import type { StyleProfile } from '@/lib/types';
import type { CollectionPagePackage } from '@/lib/embed/resolve-collection';
import { renderStyleBlock } from './styles';
import { escapeHtml } from './utils';

/**
 * Render collection page Shadow DOM HTML with style profile baked in.
 */
export function renderCollectionHtml(
  data: CollectionPagePackage,
  styleProfile: StyleProfile | null,
): string {
  const styles = renderStyleBlock(styleProfile);

  const headerSection = `<div class="sa-collection-header">
    ${data.header.hero_url ? `<img class="sa-image sa-collection-hero" data-sa-src="${escapeHtml(data.header.hero_url)}" alt="${escapeHtml(data.header.name)}" src="">` : ''}
    <div class="sa-collection-title">
      ${data.header.icon_url ? `<img class="sa-icon" data-sa-src="${escapeHtml(data.header.icon_url)}" alt="" src="">` : ''}
      <h2>${escapeHtml(data.header.name)}</h2>
    </div>
  </div>`;

  const gridSection = data.products.length > 0
    ? `<div class="sa-collection-grid">
      ${data.products.map((p) => `<div class="sa-product-card" data-product="${escapeHtml(p.product_ref)}">
        ${p.hero_url ? `<img class="sa-image" data-sa-src="${escapeHtml(p.hero_url)}" alt="${escapeHtml(p.alt)}" src="">` : ''}
        ${p.hover_url ? `<img class="sa-image sa-hover" data-sa-src="${escapeHtml(p.hover_url)}" alt="${escapeHtml(p.alt)}" src="">` : ''}
      </div>`).join('\n      ')}
    </div>`
    : '';

  return `${styles}
<div class="sa-container sa-collection">
  ${headerSection}
  ${gridSection}
  <slot></slot>
</div>`;
}
