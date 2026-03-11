import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { generateModel } from '@/lib/inngest/functions/generate-model';
import { generateImages } from '@/lib/inngest/functions/generate-images';
import { shopifyProductSync } from '@/lib/inngest/functions/shopify-sync';
import { swatchToPbr } from '@/lib/inngest/functions/swatch-to-pbr';
import { imagePull } from '@/lib/inngest/functions/image-pull';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generateModel, generateImages, shopifyProductSync, swatchToPbr, imagePull],
});
