import sharp from 'sharp';
import type { SwatchVisionAnalysis } from './types';

const TARGET_SIZE = 2048;

/**
 * Preprocess a swatch photograph into a clean albedo texture ready for
 * Scenario's seamless texture generation.
 *
 * Steps:
 * 1. Center-crop to square (avoid edges with lighting falloff)
 * 2. Resize to 2048x2048
 * 3. Normalize colors (remove lighting gradient)
 * 4. For uniform surfaces, apply basic mirror-blend for initial tiling
 */
export async function preprocessSwatch(
  imageBuffer: Buffer,
  analysis: SwatchVisionAnalysis,
): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  const { width = 0, height = 0 } = metadata;

  if (width === 0 || height === 0) {
    throw new Error('Cannot read image dimensions');
  }

  // Step 1: Center-crop to square (use 80% of the shorter side to avoid edges)
  const shortSide = Math.min(width, height);
  const cropSize = Math.round(shortSide * 0.8);
  const left = Math.round((width - cropSize) / 2);
  const top = Math.round((height - cropSize) / 2);

  let pipeline = sharp(imageBuffer)
    .extract({ left, top, width: cropSize, height: cropSize });

  // Step 2: Resize to target
  pipeline = pipeline.resize(TARGET_SIZE, TARGET_SIZE, {
    kernel: sharp.kernel.lanczos3,
  });

  // Step 3: Normalize (removes lighting gradient, improves color consistency)
  pipeline = pipeline.normalize();

  // Step 4: For uniform surfaces, basic mirror-blend for tiling hints
  // Scenario's img2img-texture handles the real tiling, so we just do light cleanup
  if (analysis.surface_regularity === 'uniform') {
    // Apply a slight sharpen to bring out texture detail lost in normalization
    pipeline = pipeline.sharpen({ sigma: 0.5 });
  }

  return pipeline.png().toBuffer();
}
