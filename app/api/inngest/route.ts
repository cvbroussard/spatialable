import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { generateModel } from '@/lib/inngest/functions/generate-model';
import { shopifyProductSync } from '@/lib/inngest/functions/shopify-sync';
import { swatchToPbr } from '@/lib/inngest/functions/swatch-to-pbr';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generateModel, shopifyProductSync, swatchToPbr],
});
