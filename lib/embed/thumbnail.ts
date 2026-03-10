import sharp from 'sharp';
import sql from '@/lib/db';
import { downloadToBuffer, uploadAssetFile, getAssetUrl } from '@/lib/r2/client';
import { extractKeyFromUrl } from '@/lib/embed/signed-url';

const THUMBNAIL_SIZE = 200;

/**
 * Ensure a 200x200 SEO thumbnail exists for a product hero asset.
 *
 * If existingThumbnailUrl is set, returns it immediately.
 * Otherwise: downloads the hero image, resizes to 200x200 WebP,
 * uploads to R2 at a public (unsigned) URL, updates the
 * product_assets.thumbnail_url column, and returns the URL.
 */
export async function ensureThumbnail(
  productRef: string,
  heroUrl: string,
  existingThumbnailUrl: string | null,
  productAssetId?: number,
): Promise<string | null> {
  if (existingThumbnailUrl) return existingThumbnailUrl;

  try {
    const imageBuffer = await downloadToBuffer(heroUrl);

    const thumbnailBuffer = await sharp(imageBuffer)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'cover' })
      .webp({ quality: 70 })
      .toBuffer();

    // Use a safe filename from the product ref
    const safeRef = productRef.replace(/[^a-zA-Z0-9_-]/g, '_');
    const key = `thumbnails/${safeRef}/hero-200.webp`;
    const url = await uploadAssetFile(thumbnailBuffer, key, 'image/webp');

    // Update product_assets row if we have the ID
    if (productAssetId) {
      await sql`
        UPDATE product_assets SET thumbnail_url = ${url}, updated_at = NOW()
        WHERE id = ${productAssetId}
      `;
    }

    return url;
  } catch (err) {
    console.error('[thumbnail] Failed to generate thumbnail:', err);
    return null;
  }
}
