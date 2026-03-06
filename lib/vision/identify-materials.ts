import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import type { MaterialIdentificationResult } from '@/lib/types';

const MaterialIdentificationSchema = z.object({
  materials: z.array(z.object({
    region: z.string().describe('Part of the product, e.g. "seat cushion", "frame legs", "handles"'),
    material_type: z.string().describe('Category/subcategory, e.g. "fabric/linen", "wood/walnut", "metal/brass"'),
    color: z.string().describe('Color description, e.g. "beige", "dark walnut", "antique brass"'),
    finish: z.string().describe('Surface finish, e.g. "matte", "satin", "polished", "brushed"'),
    confidence: z.number().min(0).max(1).describe('Confidence score 0.0-1.0'),
  })),
  dominant_material: z.string().describe('The primary material type of the product'),
  product_category: z.string().describe('Product category path, e.g. "furniture/seating/sofa"'),
});

/**
 * Identify materials in a product image using Claude Vision.
 * Returns structured material descriptions for each visible region.
 */
export async function identifyMaterials(
  imageUrl: string,
  productContext?: string,
): Promise<MaterialIdentificationResult> {
  const result = await generateObject({
    model: anthropic('claude-sonnet-4-20250514'),
    schema: MaterialIdentificationSchema,
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
            text: `Analyze this product image and identify all distinct materials visible on the product.

For each distinct material region:
- Identify the part of the product (e.g. "seat cushion", "legs", "handles")
- Classify the material type using category/subcategory format (e.g. "fabric/linen", "wood/walnut", "metal/brushed-steel", "leather/full-grain")
- Describe the color
- Describe the surface finish (matte, satin, polished, brushed, textured, etc.)
- Rate your confidence (0.0-1.0)

Also identify the dominant material and the product category.
${productContext ? `\nProduct context: ${productContext}` : ''}`,
          },
        ],
      },
    ],
  });

  return result.object;
}
