import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { generateModel } from '@/lib/inngest/functions/generate-model';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generateModel],
});
