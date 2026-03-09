// ---------------------------------------------------------------------------
// Shadow DOM base styles — injected into every <sa-media> instance
// ---------------------------------------------------------------------------

import type { StyleProfile } from './types';

export function buildStyleVars(profile: StyleProfile | null): string {
  if (!profile) return '';

  const vars: string[] = [];
  if (profile.primary_color) vars.push(`--sa-primary: ${profile.primary_color}`);
  if (profile.secondary_color) vars.push(`--sa-secondary: ${profile.secondary_color}`);
  if (profile.accent_color) vars.push(`--sa-accent: ${profile.accent_color}`);
  if (profile.font_family) vars.push(`--sa-font: ${profile.font_family}`);
  if (profile.border_radius) vars.push(`--sa-radius: ${profile.border_radius}`);
  if (profile.background_color) vars.push(`--sa-bg: ${profile.background_color}`);
  if (profile.text_color) vars.push(`--sa-text: ${profile.text_color}`);

  // Custom vars
  if (profile.custom_vars) {
    for (const [key, value] of Object.entries(profile.custom_vars)) {
      vars.push(`--sa-${key}: ${value}`);
    }
  }

  return vars.length > 0 ? vars.join(';\n    ') + ';' : '';
}

export const BASE_STYLES = `
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

  :host([hidden]) {
    display: none;
  }

  * {
    box-sizing: border-box;
  }

  .sa-container {
    width: 100%;
    height: 100%;
    position: relative;
  }

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

  /* Image styles */
  .sa-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    border-radius: var(--sa-radius, 0);
  }

  /* 3D viewer */
  .sa-viewer {
    width: 100%;
    aspect-ratio: 4/3;
    border-radius: var(--sa-radius, 0);
    overflow: hidden;
  }

  .sa-viewer model-viewer {
    width: 100%;
    height: 100%;
  }
`;
