// ---------------------------------------------------------------------------
// Google GenAI image generation types
// ---------------------------------------------------------------------------

export type ImageGenModel = 'imagen-4.0-generate-001' | 'gemini-3.1-flash-image-preview';

export interface ImageGenConfig {
  numberOfImages?: number;      // 1-4 (Imagen only)
  aspectRatio?: string;         // e.g. '1:1', '3:4', '16:9'
  imageSize?: string;           // '1K' or '2K'
}

export interface ImageGenResult {
  imageBytes: Buffer;
  mimeType: string;
}

export interface NanoBananaConfig {
  aspectRatio?: string;
  imageSize?: string;
}

export interface NanoBananaResult {
  imageBytes: Buffer;
  mimeType: string;
  text?: string;
}
