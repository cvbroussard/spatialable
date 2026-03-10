import type { StyleProfile } from '@/lib/types';
import type { HomePagePackage } from '@/lib/embed/resolve-home';
import { renderStyleBlock } from './styles';
import { escapeHtml } from './utils';

/**
 * Render home page Shadow DOM HTML with style profile baked in.
 */
export function renderHomeHtml(
  data: HomePagePackage,
  styleProfile: StyleProfile | null,
): string {
  const styles = renderStyleBlock(styleProfile);

  const heroSection = data.heroes.length > 0
    ? `<div class="sa-home-heroes">
      ${data.heroes.map((h) => `<img class="sa-image" data-sa-src="${escapeHtml(h.url)}" data-sa-id="${escapeHtml(String(h.id))}" alt="${escapeHtml(h.alt)}" src="">`).join('\n      ')}
    </div>`
    : '';

  const categorySection = data.categories.length > 0
    ? `<div class="sa-home-categories">
      ${data.categories.map((c) => `<div class="sa-category-card" data-category="${escapeHtml(c.category_path)}">
        ${c.card_url ? `<img class="sa-image" data-sa-src="${escapeHtml(c.card_url)}" alt="${escapeHtml(c.name)}" src="">` : ''}
        ${c.icon_url ? `<img class="sa-icon" data-sa-src="${escapeHtml(c.icon_url)}" alt="" src="">` : ''}
        <span class="sa-label">${escapeHtml(c.name)}</span>
      </div>`).join('\n      ')}
    </div>`
    : '';

  const brandSection = data.brands.length > 0
    ? `<div class="sa-home-brands">
      ${data.brands.map((b) => `<div class="sa-brand-card" data-brand="${escapeHtml(b.slug)}">
        ${b.card_url ? `<img class="sa-image" data-sa-src="${escapeHtml(b.card_url)}" alt="${escapeHtml(b.name)}" src="">` : ''}
        ${b.logo_url ? `<img class="sa-logo" data-sa-src="${escapeHtml(b.logo_url)}" alt="${escapeHtml(b.name)}" src="">` : ''}
        <span class="sa-label">${escapeHtml(b.name)}</span>
      </div>`).join('\n      ')}
    </div>`
    : '';

  const featuredSection = data.featured.length > 0
    ? `<div class="sa-home-featured">
      ${data.featured.map((f) => `<div class="sa-product-card">
        <img class="sa-image" data-sa-src="${escapeHtml(f.url)}" data-sa-id="${escapeHtml(String(f.id))}" alt="${escapeHtml(f.alt)}" src="">
      </div>`).join('\n      ')}
    </div>`
    : '';

  const editorialSection = data.editorial.length > 0
    ? `<div class="sa-home-editorial">
      ${data.editorial.map((e) => `<img class="sa-image" data-sa-src="${escapeHtml(e.url)}" data-sa-id="${escapeHtml(String(e.id))}" alt="${escapeHtml(e.alt)}" src="">`).join('\n      ')}
    </div>`
    : '';

  return `${styles}
<div class="sa-container sa-home">
  ${heroSection}
  ${categorySection}
  ${brandSection}
  ${featuredSection}
  ${editorialSection}
  <slot></slot>
</div>`;
}
