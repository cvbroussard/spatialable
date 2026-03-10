// ---------------------------------------------------------------------------
// Studio angle templates — Series 1 (10 standard product shots)
// ---------------------------------------------------------------------------

export interface AngleTemplate {
  key: string;
  label: string;
  position: number;
  role: 'hero' | 'gallery';
  modifier: string;
}

export const STUDIO_ANGLES: AngleTemplate[] = [
  { key: 'hero_front',          position: 0, role: 'hero',    label: 'Hero Front',          modifier: 'front-facing, straight on, centered' },
  { key: 'back',                position: 1, role: 'gallery', label: 'Back',                modifier: 'rear view, showing back of product' },
  { key: 'left_side',           position: 2, role: 'gallery', label: 'Left Side',           modifier: 'left side profile view' },
  { key: 'right_side',          position: 3, role: 'gallery', label: 'Right Side',          modifier: 'right side profile view' },
  { key: 'three_quarter_front', position: 4, role: 'gallery', label: '3/4 Front',           modifier: 'three-quarter front view, 45 degree angle' },
  { key: 'three_quarter_back',  position: 5, role: 'gallery', label: '3/4 Back',            modifier: 'three-quarter rear view, 45 degree angle from back' },
  { key: 'top_down',            position: 6, role: 'gallery', label: 'Top Down',            modifier: 'overhead bird\'s eye view, looking straight down' },
  { key: 'low_angle',           position: 7, role: 'gallery', label: 'Low Angle',           modifier: 'low angle view, camera at base looking upward' },
  { key: 'close_up',            position: 8, role: 'gallery', label: 'Close-Up',            modifier: 'material texture detail, tight crop showing surface quality' },
  { key: 'eye_level',           position: 9, role: 'gallery', label: 'Eye Level',           modifier: 'natural eye-level viewing angle' },
];

const STUDIO_SUFFIX = 'pure white studio background, professional product photography, soft even studio lighting, centered composition, high resolution, commercial quality';

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

/**
 * Build prompt for Imagen (text-only generation).
 */
export function buildStudioPrompt(description: string, template: AngleTemplate): string {
  return `${description}, ${template.modifier}, ${STUDIO_SUFFIX}`;
}

/**
 * Build prompt for Nano Banana (reference-guided generation).
 * Adds identity consistency instructions.
 */
export function buildConsistentStudioPrompt(description: string, template: AngleTemplate): string {
  return `Generate a product photograph of this exact product: ${description}. Camera angle: ${template.modifier}. Maintain exact product identity, proportions, materials, and colors from the reference image(s). ${STUDIO_SUFFIX}`;
}
