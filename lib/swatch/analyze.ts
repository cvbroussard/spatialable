import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import type { SwatchVisionAnalysis } from './types';

const SwatchAnalysisSchema = z.object({
  material_category: z.string().describe('Top-level category, e.g. "fabric", "leather", "wood", "stone"'),
  material_subcategory: z.string().describe('Specific subcategory, e.g. "linen", "velvet", "walnut", "marble"'),
  weave_pattern: z.string().describe('Weave/texture pattern, e.g. "plain", "twill", "herringbone", "satin", "knit", "n/a"'),
  color_primary: z.string().describe('Primary color as hex, e.g. "#C4B5A0"'),
  color_description: z.string().describe('Human-readable color name, e.g. "warm sand", "charcoal grey"'),
  finish: z.string().describe('Surface finish, e.g. "matte", "slight sheen", "glossy", "brushed"'),
  texture_scale: z.enum(['fine', 'medium', 'coarse']).describe('Scale of the texture pattern'),
  surface_regularity: z.enum(['uniform', 'slightly_irregular', 'heavily_textured']).describe('How regular the surface is'),
  estimated_roughness: z.number().min(0).max(1).describe('PBR roughness estimate 0.0-1.0 (0=mirror, 1=fully rough)'),
  estimated_metallic: z.number().min(0).max(1).describe('PBR metallic estimate 0.0-1.0 (usually 0 for fabrics)'),
  tiling_recommendation: z.string().describe('Brief guidance for making this tileable, e.g. "crop center to avoid edge lighting falloff, normalize color gradient"'),
  confidence: z.number().min(0).max(1).describe('Overall confidence in the analysis 0.0-1.0'),
});

/**
 * Analyze a swatch photograph using Claude Vision.
 * Extracts material type, color, weave pattern, roughness estimate, etc.
 */
export async function analyzeSwatch(
  imageUrl: string,
  context?: string,
): Promise<SwatchVisionAnalysis> {
  const result = await generateObject({
    model: anthropic('claude-sonnet-4-20250514'),
    schema: SwatchAnalysisSchema,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            image: imageUrl,
          },
          {
            type: 'text',
            text: `Analyze this material swatch photograph. This is a close-up photo of a physical material sample (fabric, leather, wood, stone, etc.) that will be used to create PBR textures for 3D rendering.

Identify:
1. Material category and subcategory (e.g. fabric/linen, leather/full-grain)
2. Weave or texture pattern (plain, twill, herringbone, etc.)
3. Primary color as hex code
4. Surface finish (matte, sheen, glossy)
5. Texture scale (fine/medium/coarse)
6. Surface regularity (uniform, slightly irregular, heavily textured)
7. Estimated PBR roughness (0.0 = mirror smooth, 1.0 = fully rough)
8. Estimated PBR metallic value (0.0 for most fabrics/wood, higher for metals)
9. Recommendations for making this tileable (cropping strategy, color normalization needs)
10. Your confidence in the overall analysis

Be precise with the hex color — sample from the most representative area of the swatch.
${context ? `\nAdditional context: ${context}` : ''}`,
          },
        ],
      },
    ],
  });

  return result.object;
}
