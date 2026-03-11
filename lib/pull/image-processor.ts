/**
 * Image Processor for Pull Pipeline
 *
 * Downloads product images from source URLs, optimizes with Sharp,
 * and uploads to R2 as WebP.
 */

import sharp from 'sharp';
import { uploadTexture, downloadToBuffer } from '@/lib/r2/client';

interface ProcessedImage {
  mainBuffer: Buffer;
  thumbBuffer: Buffer;
  width: number;
  height: number;
  bytes: number;
}

/**
 * Download and process a single image:
 *   - Resize to 2000px max (no enlargement)
 *   - Convert to WebP quality 85
 *   - Generate 400px thumbnail at WebP quality 80
 */
export async function downloadAndProcessImage(imageUrl: string): Promise<ProcessedImage> {
  const rawBuffer = await downloadToBuffer(imageUrl);

  const mainImage = sharp(rawBuffer)
    .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 });

  const mainBuffer = await mainImage.toBuffer();
  const metadata = await sharp(mainBuffer).metadata();

  const thumbBuffer = await sharp(rawBuffer)
    .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  return {
    mainBuffer,
    thumbBuffer,
    width: metadata.width || 0,
    height: metadata.height || 0,
    bytes: mainBuffer.length,
  };
}

/**
 * Upload processed image and thumbnail to R2.
 * Key pattern: source-images/brand-pull/{brandTargetId}/{handle}/{position}.webp
 *
 * Returns { imageUrl, thumbnailUrl } — public CDN URLs.
 */
export async function uploadSourceImage(
  mainBuffer: Buffer,
  thumbBuffer: Buffer,
  brandTargetId: number,
  handle: string,
  position: number,
): Promise<{ imageUrl: string; thumbnailUrl: string }> {
  const basePath = `source-images/brand-pull/${brandTargetId}/${handle}`;

  const imageUrl = await uploadTexture(
    mainBuffer,
    `${basePath}/${position}.webp`,
    'image/webp',
  );

  const thumbnailUrl = await uploadTexture(
    thumbBuffer,
    `${basePath}/${position}_thumb.webp`,
    'image/webp',
  );

  return { imageUrl, thumbnailUrl };
}
