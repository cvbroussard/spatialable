import { inngest } from '../client';
import sql from '@/lib/db';
import { discoverUrlsFromSitemaps } from '@/lib/pull/sitemap-parser';
import { fetchProduct } from '@/lib/pull/shopify-fetcher';
import { downloadAndProcessImage, uploadSourceImage } from '@/lib/pull/image-processor';
import type { PullResult } from '@/lib/pull/types';

const BATCH_SIZE = 25;

/**
 * Image Pull pipeline.
 *
 * Event: spatialable/pull.requested
 * Data: { brandTargetId: number, runId: string }
 *
 * Steps:
 *   1. discover-urls    — Parse sitemaps, filter URLs, store count
 *   2. process-batch-N  — Chunks of ~25 products: fetch JSON, download/optimize/upload images, insert source_images rows
 *   3. finalize         — Update brand_targets counters, mark run completed
 */
export const imagePull = inngest.createFunction(
  {
    id: 'image-pull',
    retries: 1,
  },
  { event: 'spatialable/pull.requested' },
  async ({ event, step }) => {
    const { brandTargetId, runId } = event.data;

    // ── Step 1: Discover URLs ──────────────────────────────────────────

    const productUrls = await step.run('discover-urls', async () => {
      const [target] = await sql`
        SELECT sitemaps, url_pattern_include, url_pattern_exclude
        FROM brand_targets WHERE id = ${brandTargetId}
      `;
      if (!target) throw new Error(`Brand target ${brandTargetId} not found`);
      if (!target.sitemaps || target.sitemaps.length === 0) {
        throw new Error(`Brand target ${brandTargetId} has no sitemaps configured`);
      }

      const urls = await discoverUrlsFromSitemaps(
        target.sitemaps,
        target.url_pattern_include || undefined,
        target.url_pattern_exclude || undefined,
      );

      await sql`
        UPDATE pull_runs
        SET discovered_urls = ${urls.length}
        WHERE id = ${runId}
      `;

      await sql`
        UPDATE brand_targets
        SET discovered_count = ${urls.length}, updated_at = NOW()
        WHERE id = ${brandTargetId}
      `;

      return urls;
    });

    // ── Step 2: Process in batches ─────────────────────────────────────

    const totalBatches = Math.ceil(productUrls.length / BATCH_SIZE);
    let totalCreated = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const batchStart = batchIdx * BATCH_SIZE;
      const batchUrls = productUrls.slice(batchStart, batchStart + BATCH_SIZE);

      const batchResult = await step.run(`process-batch-${batchIdx}`, async () => {
        const [target] = await sql`
          SELECT request_delay_ms FROM brand_targets WHERE id = ${brandTargetId}
        `;
        const delayMs = target?.request_delay_ms || 500;

        let created = 0;
        let skipped = 0;
        let failed = 0;
        const errors: { url: string; error: string }[] = [];

        for (const url of batchUrls) {
          try {
            // Update current URL for UI progress
            await sql`
              UPDATE pull_runs SET current_url = ${url} WHERE id = ${runId}
            `;

            // Fetch product data from Shopify JSON API
            const product = await fetchProduct(url, delayMs);

            if (product.images.length === 0) {
              skipped++;
              continue;
            }

            // Process each image
            let productCreated = 0;
            for (const img of product.images) {
              try {
                // Check dedup: skip if this source_url + position already exists
                const [existing] = await sql`
                  SELECT id FROM source_images
                  WHERE source_url = ${img.src} AND image_position = ${img.position}
                `;
                if (existing) {
                  skipped++;
                  continue;
                }

                // Download, optimize, upload
                const processed = await downloadAndProcessImage(img.src);
                const { imageUrl, thumbnailUrl } = await uploadSourceImage(
                  processed.mainBuffer,
                  processed.thumbBuffer,
                  brandTargetId,
                  product.handle,
                  img.position,
                );

                // Insert source_images row
                await sql`
                  INSERT INTO source_images (
                    image_url, original_url, thumbnail_url,
                    funnel, curation_status, brand_target_id,
                    product_name, category,
                    gtin, upc, sku,
                    width, height, file_size_bytes, content_type,
                    source_url, vendor, product_handle, image_position
                  ) VALUES (
                    ${imageUrl}, ${img.src}, ${thumbnailUrl},
                    'brand_pull', 'pending', ${brandTargetId},
                    ${product.title}, ${product.product_type},
                    ${product.gtin}, ${product.upc}, ${product.sku},
                    ${processed.width}, ${processed.height}, ${processed.bytes}, 'image/webp',
                    ${img.src}, ${product.vendor}, ${product.handle}, ${img.position}
                  )
                `;

                productCreated++;
              } catch (imgErr) {
                errors.push({
                  url: img.src,
                  error: imgErr instanceof Error ? imgErr.message : String(imgErr),
                });
                failed++;
              }
            }

            if (productCreated > 0) created += productCreated;
          } catch (err) {
            errors.push({
              url,
              error: err instanceof Error ? err.message : String(err),
            });
            failed++;
          }
        }

        // Update run progress
        await sql`
          UPDATE pull_runs
          SET processed_count = processed_count + ${batchUrls.length},
              created_count = created_count + ${created},
              skipped_count = skipped_count + ${skipped},
              failed_count = failed_count + ${failed},
              errors = errors || ${JSON.stringify(errors)}::jsonb
          WHERE id = ${runId}
        `;

        return { created, skipped, failed };
      });

      totalCreated += batchResult.created;
      totalSkipped += batchResult.skipped;
      totalFailed += batchResult.failed;
    }

    // ── Step 3: Finalize ───────────────────────────────────────────────

    await step.run('finalize', async () => {
      // Update brand_targets counters
      const [counts] = await sql`
        SELECT COUNT(*) as total
        FROM source_images
        WHERE brand_target_id = ${brandTargetId}
      `;

      await sql`
        UPDATE brand_targets
        SET image_count = ${counts.total},
            pulled_count = pulled_count + ${totalCreated},
            last_pull_at = NOW(),
            updated_at = NOW()
        WHERE id = ${brandTargetId}
      `;

      // Mark run completed
      await sql`
        UPDATE pull_runs
        SET status = 'completed',
            current_url = NULL,
            completed_at = NOW()
        WHERE id = ${runId}
      `;
    });

    return {
      runId,
      brandTargetId,
      discovered: productUrls.length,
      created: totalCreated,
      skipped: totalSkipped,
      failed: totalFailed,
    };
  },
);
