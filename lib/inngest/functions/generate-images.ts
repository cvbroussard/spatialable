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
 *   1. load-job                    → read job record, download reference images
 *   2. generate-and-upload-{angle} → per-angle: generate, process, upload to R2
 *   3. create-records              → insert source_images + product_assets rows
 *   4. complete-job                → mark job complete
 *
 * Each angle is its own step to avoid Inngest's step output size limit
 * (base64 image data is ~1.2MB per image, 12MB+ total would exceed 4MB cap).
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
        refBuffers,
      };
    });

    // Step 2: Generate + upload each angle as its own step (avoids large step outputs)
    const uploads: { angle: string; url: string; thumbUrl: string }[] = [];

    for (const template of STUDIO_ANGLES) {
      const result = await step.run(`generate-and-upload-${template.key}`, async () => {
        const refs = jobData.refBuffers.map((r) => ({
          data: Buffer.from(r.data, 'base64'),
          mimeType: r.mimeType,
        }));

        const prompt = refs.length > 0
          ? buildConsistentStudioPrompt(jobData.prompt, template)
          : buildStudioPrompt(jobData.prompt, template);

        try {
          const genResult = await generateImage(
            prompt,
            refs.length > 0 ? refs : undefined,
          );

          // Process with sharp: main 1024x1024 + thumb 256x256
          const mainBuffer = await sharp(genResult.imageBytes)
            .resize(1024, 1024, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
            .webp({ quality: 90 })
            .toBuffer();

          const thumbBuffer = await sharp(genResult.imageBytes)
            .resize(256, 256, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
            .webp({ quality: 80 })
            .toBuffer();

          const mainKey = `source-images/ai-gen/${jobData.gtin}/${template.key}.webp`;
          const thumbKey = `source-images/ai-gen/${jobData.gtin}/${template.key}_thumb.webp`;

          const mainUrl = await uploadTexture(mainBuffer, mainKey, 'image/webp');
          const thumbUrl = await uploadTexture(thumbBuffer, thumbKey, 'image/webp');

          // Update progress counter
          await sql`
            UPDATE image_gen_jobs
            SET completed_images = completed_images + 1,
                model_used = ${genResult.model},
                updated_at = NOW()
            WHERE id = ${jobId}
          `;

          return { angle: template.key, url: mainUrl, thumbUrl, ok: true as const };
        } catch (err: any) {
          console.error(`[generate-images] Failed angle ${template.key}:`, err.message);
          return { angle: template.key, url: '', thumbUrl: '', ok: false as const };
        }
      });

      if (result.ok) {
        uploads.push({ angle: result.angle, url: result.url, thumbUrl: result.thumbUrl });
      }
    }

    if (uploads.length === 0) {
      await step.run('mark-failed', async () => {
        await sql`
          UPDATE image_gen_jobs
          SET status = 'failed', error = 'All image generations failed', updated_at = NOW()
          WHERE id = ${jobId}
        `;
      });
      throw new Error('All image generations failed');
    }

    // Step 3: Create source_images + product_assets records
    const records = await step.run('create-records', async () => {
      await sql`
        UPDATE image_gen_jobs SET status = 'uploading', updated_at = NOW()
        WHERE id = ${jobId}
      `;

      const results: { angle: string; url: string; sourceImageId: number; productAssetId: number }[] = [];

      for (const upload of uploads) {
        const template = STUDIO_ANGLES.find((t) => t.key === upload.angle)!;

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

    // Step 4: Mark complete
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
