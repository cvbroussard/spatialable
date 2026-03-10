import { inngest } from '../client';
import sql from '@/lib/db';
import { generateImage } from '@/lib/google/image-gen';
import { STUDIO_ANGLES, buildStudioPrompt, buildConsistentStudioPrompt } from '@/lib/google/prompt-templates';
import { uploadTexture, downloadToBuffer } from '@/lib/r2/client';
import sharp from 'sharp';

/**
 * Image generation pipeline — 10 studio angle product shots.
 *
 * Event: spatialable/images.generate-requested
 * Data: { jobId: string }
 *
 * Steps:
 *   1. load-job           → read job record, download reference images
 *   2. generate-images    → loop 10 angles, call Google API
 *   3. upload-to-r2       → convert to WebP, upload main + thumb
 *   4. create-records     → insert source_images + product_assets rows
 *   5. complete-job       → mark job complete
 */
export const generateImages = inngest.createFunction(
  {
    id: 'generate-images',
    retries: 1,
  },
  { event: 'spatialable/images.generate-requested' },
  async ({ event, step }) => {
    const { jobId } = event.data;

    // Step 1: Load job and prepare reference images
    const jobData = await step.run('load-job', async () => {
      const [job] = await sql`SELECT * FROM image_gen_jobs WHERE id = ${jobId}`;
      if (!job) throw new Error(`Image gen job ${jobId} not found`);

      // Download reference images if provided
      const refBuffers: { data: string; mimeType: string }[] = [];
      const sourceRefs = (job.source_refs || []) as string[];

      for (const refUrl of sourceRefs) {
        try {
          const buffer = await downloadToBuffer(refUrl);
          refBuffers.push({
            data: buffer.toString('base64'),
            mimeType: 'image/jpeg',
          });
        } catch (err: any) {
          console.warn(`[generate-images] Failed to download ref: ${refUrl}`, err.message);
        }
      }

      await sql`
        UPDATE image_gen_jobs
        SET status = 'generating', started_at = NOW(), updated_at = NOW()
        WHERE id = ${jobId}
      `;

      return {
        gtin: job.gtin as string,
        clientId: job.client_id as string,
        prompt: job.source_prompt as string,
        hasRefs: refBuffers.length > 0,
        refBuffers,
      };
    });

    // Step 2: Generate images for all 10 angles
    const generated = await step.run('generate-images', async () => {
      const results: { angle: string; imageBase64: string; model: string }[] = [];
      const refs = jobData.refBuffers.map((r) => ({
        data: Buffer.from(r.data, 'base64'),
        mimeType: r.mimeType,
      }));

      for (const template of STUDIO_ANGLES) {
        try {
          const prompt = refs.length > 0
            ? buildConsistentStudioPrompt(jobData.prompt, template)
            : buildStudioPrompt(jobData.prompt, template);

          const result = await generateImage(
            prompt,
            refs.length > 0 ? refs : undefined,
          );

          results.push({
            angle: template.key,
            imageBase64: result.imageBytes.toString('base64'),
            model: result.model,
          });

          // Update progress counter
          await sql`
            UPDATE image_gen_jobs
            SET completed_images = ${results.length},
                model_used = ${result.model},
                updated_at = NOW()
            WHERE id = ${jobId}
          `;
        } catch (err: any) {
          console.error(`[generate-images] Failed angle ${template.key}:`, err.message);
          // Partial success OK — continue with remaining angles
        }
      }

      if (results.length === 0) {
        throw new Error('All image generations failed');
      }

      return results;
    });

    // Step 3: Process and upload to R2
    const uploads = await step.run('upload-to-r2', async () => {
      await sql`
        UPDATE image_gen_jobs SET status = 'uploading', updated_at = NOW()
        WHERE id = ${jobId}
      `;

      const uploaded: { angle: string; url: string; thumbUrl: string }[] = [];

      for (const img of generated) {
        const rawBuffer = Buffer.from(img.imageBase64, 'base64');

        // Main image: 1024x1024 WebP
        const mainBuffer = await sharp(rawBuffer)
          .resize(1024, 1024, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
          .webp({ quality: 90 })
          .toBuffer();

        // Thumbnail: 256x256 WebP
        const thumbBuffer = await sharp(rawBuffer)
          .resize(256, 256, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
          .webp({ quality: 80 })
          .toBuffer();

        const mainKey = `source-images/ai-gen/${jobData.gtin}/${img.angle}.webp`;
        const thumbKey = `source-images/ai-gen/${jobData.gtin}/${img.angle}_thumb.webp`;

        const mainUrl = await uploadTexture(mainBuffer, mainKey, 'image/webp');
        const thumbUrl = await uploadTexture(thumbBuffer, thumbKey, 'image/webp');

        uploaded.push({ angle: img.angle, url: mainUrl, thumbUrl });
      }

      return uploaded;
    });

    // Step 4: Create source_images + product_assets records
    const records = await step.run('create-records', async () => {
      const results: { angle: string; url: string; sourceImageId: number; productAssetId: number }[] = [];

      for (const upload of uploads) {
        const template = STUDIO_ANGLES.find((t) => t.key === upload.angle)!;

        // Insert source_images row
        const [srcImg] = await sql`
          INSERT INTO source_images (
            image_url, thumbnail_url, funnel, curation_status,
            gtin, angle, product_name
          ) VALUES (
            ${upload.url},
            ${upload.thumbUrl},
            'ai_generated'::source_funnel,
            'candidate'::curation_status,
            ${jobData.gtin},
            ${upload.angle},
            ${jobData.prompt}
          )
          RETURNING id
        `;

        // Upsert product_assets row (ON CONFLICT for re-generation)
        const [prodAsset] = await sql`
          INSERT INTO product_assets (
            product_ref, role, position, content_type, url, alt
          ) VALUES (
            ${jobData.gtin},
            ${template.role}::asset_role,
            ${template.position},
            'image/webp',
            ${upload.url},
            ${`${jobData.prompt} - ${template.label}`}
          )
          ON CONFLICT (product_ref, position)
          DO UPDATE SET
            url = EXCLUDED.url,
            alt = EXCLUDED.alt,
            updated_at = NOW()
          RETURNING id
        `;

        results.push({
          angle: upload.angle,
          url: upload.url,
          sourceImageId: srcImg.id,
          productAssetId: prodAsset.id,
        });
      }

      return results;
    });

    // Step 5: Mark complete
    await step.run('complete-job', async () => {
      await sql`
        UPDATE image_gen_jobs
        SET status = 'complete',
            results = ${JSON.stringify(records)},
            completed_images = ${records.length},
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = ${jobId}
      `;
    });

    return { jobId, imageCount: records.length, status: 'complete' };
  },
);
