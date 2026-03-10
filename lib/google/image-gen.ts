import { GoogleGenAI } from '@google/genai';
import type { ImageGenConfig, ImageGenResult, NanoBananaConfig, NanoBananaResult } from './types';

// ---------------------------------------------------------------------------
// Client singleton
// ---------------------------------------------------------------------------

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (_client) return _client;
  const apiKey = process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_GENAI_API_KEY not set');
  _client = new GoogleGenAI({ apiKey });
  return _client;
}

// ---------------------------------------------------------------------------
// Imagen 4 Fast — text-only, $0.02/image
// ---------------------------------------------------------------------------

export async function generateProductImage(
  prompt: string,
  config: ImageGenConfig = {},
): Promise<ImageGenResult> {
  const ai = getClient();

  const response = await ai.models.generateImages({
    model: 'imagen-4.0-generate-001',
    prompt,
    config: {
      numberOfImages: config.numberOfImages ?? 1,
      aspectRatio: config.aspectRatio ?? '1:1',
    },
  });

  const generated = response.generatedImages?.[0];
  if (!generated?.image?.imageBytes) {
    throw new Error('Imagen returned no image data');
  }

  return {
    imageBytes: Buffer.from(generated.image.imageBytes, 'base64'),
    mimeType: 'image/png',
  };
}

// ---------------------------------------------------------------------------
// Nano Banana Pro — reference-guided via Gemini, ~$0.13/image
// ---------------------------------------------------------------------------

export async function generateConsistentProductImage(
  prompt: string,
  referenceBuffers: { data: Buffer; mimeType: string }[],
  config: NanoBananaConfig = {},
): Promise<NanoBananaResult> {
  const ai = getClient();

  // Build content parts: text prompt + reference images
  const contents: any[] = [{ text: prompt }];
  for (const ref of referenceBuffers) {
    contents.push({
      inlineData: {
        mimeType: ref.mimeType,
        data: ref.data.toString('base64'),
      },
    });
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents,
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        aspectRatio: config.aspectRatio ?? '1:1',
        imageSize: config.imageSize ?? '1K',
      },
    },
  });

  // Extract generated image from response parts
  const parts = response.candidates?.[0]?.content?.parts || [];
  let imageBytes: Buffer | null = null;
  let text: string | undefined;

  for (const part of parts) {
    if ((part as any).text) {
      text = (part as any).text;
    } else if ((part as any).inlineData) {
      imageBytes = Buffer.from((part as any).inlineData.data, 'base64');
    }
  }

  if (!imageBytes) {
    throw new Error('Nano Banana returned no image data');
  }

  return {
    imageBytes,
    mimeType: 'image/png',
    text,
  };
}

// ---------------------------------------------------------------------------
// Auto-select: references → Nano Banana, no references → Imagen
// ---------------------------------------------------------------------------

export async function generateImage(
  prompt: string,
  referenceBuffers?: { data: Buffer; mimeType: string }[],
  config: ImageGenConfig & NanoBananaConfig = {},
): Promise<ImageGenResult & { model: string; text?: string }> {
  if (referenceBuffers && referenceBuffers.length > 0) {
    const result = await generateConsistentProductImage(prompt, referenceBuffers, config);
    return { ...result, model: 'gemini-3.1-flash-image-preview' };
  }

  const result = await generateProductImage(prompt, config);
  return { ...result, model: 'imagen-4.0-generate-001' };
}

// ---------------------------------------------------------------------------
// Util
// ---------------------------------------------------------------------------

export function isGoogleGenAIConfigured(): boolean {
  return !!process.env.GOOGLE_GENAI_API_KEY;
}
