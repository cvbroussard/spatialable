import { inngest } from '../client';
import sql from '@/lib/db';
import { createImageTo3D, createMultiImageTo3D, pollUntilComplete } from '@/lib/tripo/client';
import { identifyMaterials } from '@/lib/vision/identify-materials';
import { downloadToBuffer, uploadGlb, uploadTexture, generateAssetKey } from '@/lib/r2/client';

/**
 * Main pipeline orchestration function.
 *
 * Event: spatialable/generate.requested
 * Data: { jobId: string, clientId: string }
 *
 * Steps:
 *   1. submit-to-tripo      → upload image(s), create task
 *   2. wait-for-tripo       → poll until success
 *   3. transfer-to-r2       → download GLB + rendered image, upload to R2
 *   4. identify-materials   → Claude Vision material analysis
 *   5. create-asset         → insert asset record
 *
 * Phase 1 uses Tripo's built-in texturing. Phase 2 replaces with PBR.
 */
export const generateModel = inngest.createFunction(
  {
    id: 'generate-model',
    retries: 2,
  },
  { event: 'spatialable/generate.requested' },
  async ({ event, step }) => {
    const { jobId } = event.data;

    // Step 1: Submit to Tripo
    const tripoTaskId = await step.run('submit-to-tripo', async () => {
      const [job] = await sql`SELECT * FROM generation_jobs WHERE id = ${jobId}`;
      if (!job) throw new Error(`Job ${jobId} not found`);

      const images = job.source_images as string[];

      // Use multi-image endpoint when 2+ source images provided
      const taskId = images.length > 1
        ? await createMultiImageTo3D({ image_urls: images.slice(0, 4) })
        : await createImageTo3D({ image_url: images[0] });

      await sql`
        UPDATE generation_jobs
        SET status = 'meshy_submitted', meshy_task_id = ${taskId},
            started_at = NOW(), updated_at = NOW()
        WHERE id = ${jobId}
      `;

      return taskId;
    });

    // Step 2: Wait for Tripo completion
    const tripoResult = await step.run('wait-for-tripo', async () => {
      const result = await pollUntilComplete(tripoTaskId);
      return {
        modelUrl: result.output?.pbr_model || result.output?.model || null,
        thumbnailUrl: result.output?.rendered_image || null,
      };
    });

    // Step 3: Download Tripo output and upload to R2
    const r2Urls = await step.run('transfer-to-r2', async () => {
      if (!tripoResult.modelUrl) {
        throw new Error('Tripo did not return a model URL');
      }

      const glbBuffer = await downloadToBuffer(tripoResult.modelUrl);
      const glbKey = generateAssetKey(jobId, 'model.glb');
      const glbPublicUrl = await uploadGlb(glbBuffer, glbKey);

      let thumbnailUrl: string | undefined;
      if (tripoResult.thumbnailUrl) {
        const thumbBuffer = await downloadToBuffer(tripoResult.thumbnailUrl);
        const thumbKey = generateAssetKey(jobId, 'thumbnail.png');
        thumbnailUrl = await uploadTexture(thumbBuffer, thumbKey);
      }

      await sql`
        UPDATE generation_jobs
        SET status = 'mesh_ready', raw_mesh_url = ${glbPublicUrl}, updated_at = NOW()
        WHERE id = ${jobId}
      `;

      return { glbUrl: glbPublicUrl, thumbnailUrl, fileSize: glbBuffer.length };
    });

    // Step 4: Material identification via Claude Vision
    const materialAnalysis = await step.run('identify-materials', async () => {
      const [job] = await sql`SELECT * FROM generation_jobs WHERE id = ${jobId}`;
      const images = job.source_images as string[];
      const productMeta = (job.product_metadata || {}) as Record<string, any>;

      await sql`
        UPDATE generation_jobs SET status = 'material_matching', updated_at = NOW()
        WHERE id = ${jobId}
      `;

      const context = productMeta.name
        ? `${productMeta.name}${productMeta.category ? ` - ${productMeta.category}` : ''}`
        : undefined;

      const analysis = await identifyMaterials(images[0], context);

      // Match identified materials against the library
      const matchedIds: number[] = [];
      for (const mat of analysis.materials) {
        const matches = await sql`
          SELECT id FROM materials
          WHERE material_type ILIKE ${mat.material_type + '%'}
          ORDER BY
            CASE WHEN material_type = ${mat.material_type} THEN 0 ELSE 1 END,
            created_at DESC
          LIMIT 1
        `;
        if (matches.length > 0) {
          matchedIds.push(matches[0].id);
        }
      }

      await sql`
        UPDATE generation_jobs
        SET status = 'materials_matched',
            identified_materials = ${JSON.stringify(analysis)},
            matched_material_ids = ${matchedIds.length > 0 ? matchedIds : null},
            updated_at = NOW()
        WHERE id = ${jobId}
      `;

      return analysis;
    });

    // Step 5: Create asset record
    const assetId = await step.run('create-asset', async () => {
      const [job] = await sql`SELECT * FROM generation_jobs WHERE id = ${jobId}`;
      const meta = (job.product_metadata || {}) as Record<string, any>;

      const specificity = meta.upc ? 'upc' : meta.sku ? 'sku' : 'form_factor';

      const [asset] = await sql`
        INSERT INTO assets (
          specificity, status, upc, manufacturer_sku,
          glb_url, thumbnail_url, file_size_bytes,
          source_images, category_path, attributes, tags
        ) VALUES (
          ${specificity}::asset_specificity,
          'review'::asset_status,
          ${meta.upc || null},
          ${meta.sku || null},
          ${r2Urls.glbUrl},
          ${r2Urls.thumbnailUrl || null},
          ${r2Urls.fileSize},
          ${JSON.stringify(job.source_images)},
          ${materialAnalysis.product_category || null},
          ${JSON.stringify(meta)},
          ${[]}::text[]
        )
        RETURNING id
      `;

      await sql`
        UPDATE generation_jobs
        SET status = 'review', final_asset_id = ${asset.id},
            completed_at = NOW(), updated_at = NOW()
        WHERE id = ${jobId}
      `;

      // If client has a webhook, notify
      const [client] = await sql`
        SELECT webhook_url FROM clients WHERE id = ${job.client_id}
      `;
      if (client?.webhook_url) {
        fetch(client.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'generation.complete',
            job_id: jobId,
            client_product_id: meta.client_product_id,
            asset: {
              id: asset.id,
              glb_url: r2Urls.glbUrl,
              thumbnail_url: r2Urls.thumbnailUrl,
              specificity,
              file_size: r2Urls.fileSize,
            },
          }),
        }).catch(() => {}); // fire-and-forget
      }

      return asset.id;
    });

    return { jobId, assetId, status: 'review' };
  },
);
