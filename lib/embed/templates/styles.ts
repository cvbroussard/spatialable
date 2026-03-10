import type { StyleProfile } from '@/lib/types';

/**
 * Build CSS custom property declarations from a style profile.
 */
function buildStyleVars(profile: StyleProfile | null): string {
  if (!profile) return '';

  const vars: string[] = [];
  if (profile.primary_color) vars.push(`--sa-primary: ${profile.primary_color}`);
  if (profile.secondary_color) vars.push(`--sa-secondary: ${profile.secondary_color}`);
  if (profile.accent_color) vars.push(`--sa-accent: ${profile.accent_color}`);
  if (profile.font_family) vars.push(`--sa-font: ${profile.font_family}`);
  if (profile.border_radius) vars.push(`--sa-radius: ${profile.border_radius}`);
  if (profile.background_color) vars.push(`--sa-bg: ${profile.background_color}`);
  if (profile.text_color) vars.push(`--sa-text: ${profile.text_color}`);

  if (profile.custom_vars) {
    for (const [key, value] of Object.entries(profile.custom_vars)) {
      vars.push(`--sa-${key}: ${value}`);
    }
  }

  return vars.length > 0 ? vars.join(';\n    ') + ';' : '';
}

/**
 * Generate a complete <style> block for Shadow DOM injection.
 * Includes base styles, gallery styles, and baked style profile variables.
 */
export function renderStyleBlock(profile: StyleProfile | null): string {
  const vars = buildStyleVars(profile);
  const hostOverrides = vars ? `\n  :host { ${vars} }` : '';

  return `<style>
  :host {
    display: block;
    position: relative;
    overflow: hidden;
    font-family: var(--sa-font, system-ui, -apple-system, sans-serif);
    color: var(--sa-text, #1a1a1a);
    background: var(--sa-bg, transparent);
    border-radius: var(--sa-radius, 0);
    line-height: 1.5;
    box-sizing: border-box;
  }
  :host([hidden]) { display: none; }
  * { box-sizing: border-box; }

  /* Hide slotted content (retailer fallback) when we have assets */
  ::slotted(*) { display: none !important; }

  .sa-container { width: 100%; height: 100%; position: relative; }

  /* Loading skeleton */
  .sa-loading {
    width: 100%;
    aspect-ratio: 4/3;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: sa-shimmer 1.5s ease-in-out infinite;
    border-radius: var(--sa-radius, 0);
  }
  @keyframes sa-shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  /* Error state */
  .sa-error {
    width: 100%;
    aspect-ratio: 4/3;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f8f8f8;
    color: #999;
    font-size: 14px;
    border-radius: var(--sa-radius, 0);
    border: 1px dashed #ddd;
  }

  /* Image/video styles */
  .sa-image, .sa-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    border-radius: var(--sa-radius, 0);
  }

  /* Pending hydration — show shimmer placeholder */
  [data-sa-src]:not([src]), [data-sa-src][src=""] {
    background: #f0f0f0;
    min-height: 200px;
  }

  /* 3D viewer */
  .sa-viewer {
    width: 100%;
    aspect-ratio: 4/3;
    border-radius: var(--sa-radius, 0);
    overflow: hidden;
    background: #f8f8f8;
  }
  .sa-viewer model-viewer { width: 100%; height: 100%; }

  /* Gallery */
  .sa-gallery { display: flex; flex-direction: column; gap: 8px; width: 100%; }
  .sa-gallery-main {
    width: 100%;
    aspect-ratio: 4/3;
    position: relative;
    overflow: hidden;
    border-radius: var(--sa-radius, 0);
    background: #f8f8f8;
  }
  .sa-gallery-thumbs {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding: 2px;
    scrollbar-width: thin;
  }
  .sa-gallery-thumb {
    width: 60px;
    height: 60px;
    flex-shrink: 0;
    border-radius: 4px;
    overflow: hidden;
    cursor: pointer;
    border: 2px solid transparent;
    opacity: 0.6;
    transition: opacity 0.2s, border-color 0.2s;
    background: #f0f0f0;
  }
  .sa-gallery-thumb:hover { opacity: 0.9; }
  .sa-gallery-thumb.active {
    border-color: var(--sa-primary, #333);
    opacity: 1;
  }
  .sa-gallery-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    pointer-events: none;
  }
  .sa-gallery-thumb-3d {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 600;
    color: #666;
    background: #e8e8e8;
  }
${hostOverrides}
</style>`;
}
