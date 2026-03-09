import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { generateModel } from '@/lib/inngest/functions/generate-model';
import { shopifyProductSync } from '@/lib/inngest/functions/shopify-sync';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generateModel, shopifyProductSync],
});
