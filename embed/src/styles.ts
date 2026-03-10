// ---------------------------------------------------------------------------
// Minimal client-side styles — loading skeleton only.
// All other styles are server-rendered with the style profile baked in.
// ---------------------------------------------------------------------------

export const LOADING_STYLES = `
  :host {
    display: block;
    position: relative;
    overflow: hidden;
  }
  :host([hidden]) { display: none; }
  .sa-loading {
    width: 100%;
    aspect-ratio: 4/3;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: sa-shimmer 1.5s ease-in-out infinite;
  }
  @keyframes sa-shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
`;
