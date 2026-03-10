import { inngest } from '../client';
import sql from '@/lib/db';
import { analyzeSwatch } from '@/lib/swatch/analyze';
import { preprocessSwatch } from '@/lib/swatch/preprocess';
import type { SwatchVisionAnalysis } from '@/lib/swatch/types';
import {
  uploadAsset,
  generateSeamlessTexture,
  generatePbrMaps,
  pollUntilComplete,
  downloadAsset,
} from '@/lib/swatch/scenario';
import {
  downloadToBuffer,
  uploadTexture,
} from '@/lib/r2/client';

/**
 * Swatch-to-PBR material pipeline.
 *
 * Event: spatialable/swatch.uploaded
 * Data: { jobId: string }
 *
 * Steps:
 *   1. analyze-swatch       → Claude Vision analysis
 *   2. preprocess-albedo    → Sharp crop/normalize → upload to R2
 *   3. generate-seamless    → Scenario img2img-texture → seamless albedo
 *   4. derive-pbr-maps      → Scenario texture → normal, height, roughness, metallic, AO
 *   5. create-material      → INSERT into materials table
 */
export const swatchToPbr = inngest.createFunction(
  {
    id: 'swatch-to-pbr',
    retries: 2,
  },
  { event: 'spatialable/swatch.uploaded' },
  async ({ event, step }) => {
    const { jobId } = event.data;

    // Step 1: Analyze swatch with Claude Vision
    const analysis = await step.run('analyze-swatch', async () => {
      await sql`
        UPDATE swatch_jobs SET status = 'analyzing', updated_at = NOW()
        WHERE id = ${jobId}
      `;

      const [job] = await sql`SELECT * FROM swatch_jobs WHERE id = ${jobId}`;
      if (!job) throw new Error(`Swatch job ${jobId} not found`);

      const context = [job.material_name, job.manufacturer_name]
        .filter(Boolean)
        .join(' — ');

      const result = await analyzeSwatch(job.swatch_image_url, context || undefined);

      const derivedType = `${result.material_category}/${result.material_subcategory}`;
      const derivedTags = [
        result.material_category,
        result.material_subcategory,
        result.weave_pattern !== 'n/a' ? result.weave_pattern : null,
        result.finish,
        result.color_description,
      ].filter(Boolean) as string[];

      await sql`
        UPDATE swatch_jobs
        SET vision_analysis = ${JSON.stringify(result)},
            derived_material_type = ${derivedType},
            derived_tags = ${derivedTags},
            updated_at = NOW()
        WHERE id = ${jobId}
      `;

      return result;
    });

    // Step 2: Preprocess albedo (crop, normalize, resize)
    const preprocessedUrl = await step.run('preprocess-albedo', async () => {
      await sql`
        UPDATE swatch_jobs SET status = 'preprocessing', updated_at = NOW()
        WHERE id = ${jobId}
      `;

      const [job] = await sql`SELECT * FROM swatch_jobs WHERE id = ${jobId}`;
      const imageBuffer = await downloadToBuffer(job.swatch_image_url);
      const processed = await preprocessSwatch(imageBuffer, analysis as SwatchVisionAnalysis);

      const key = `materials/swatch/${jobId}/albedo_2k.png`;
      const url = await uploadTexture(processed, key);

      await sql`
        UPDATE swatch_jobs SET preprocessed_albedo_url = ${url}, updated_at = NOW()
        WHERE id = ${jobId}
      `;

      return url;
    });

    // Step 3: Generate seamless texture via Scenario
    const seamlessAlbedoUrl = await step.run('generate-seamless', async () => {
      const [job] = await sql`SELECT * FROM swatch_jobs WHERE id = ${jobId}`;

      // Download preprocessed albedo and upload to Scenario
      const albedoBuffer = await downloadToBuffer(preprocessedUrl);
      const scenarioAssetId = await uploadAsset(albedoBuffer, `swatch_${jobId}.png`);

      const derivedType = job.derived_material_type || 'material';
      const prompt = `seamless tileable ${derivedType} texture, photorealistic PBR material, uniform lighting, no shadows`;

      const inferenceId = await generateSeamlessTexture(scenarioAssetId, prompt);
      const result = await pollUntilComplete(inferenceId);

      if (!result.assets || result.assets.length === 0) {
        throw new Error('Scenario did not return seamless texture');
      }

      // Download seamless result and upload to R2
      const seamlessBuffer = await downloadAsset(result.assets[0].url);
      const key = `materials/swatch/${jobId}/albedo_seamless.png`;
      const url = await uploadTexture(seamlessBuffer, key);

      return url;
    });

    // Step 4: Derive PBR maps from seamless albedo via Scenario
    const pbrMapUrls = await step.run('derive-pbr-maps', async () => {
      await sql`
        UPDATE swatch_jobs SET status = 'deriving', updated_at = NOW()
        WHERE id = ${jobId}
      `;

      // Download seamless albedo and upload to Scenario
      const albedoBuffer = await downloadToBuffer(seamlessAlbedoUrl);
      const scenarioAssetId = await uploadAsset(albedoBuffer, `albedo_${jobId}.png`);

      const inferenceId = await generatePbrMaps(scenarioAssetId);

      await sql`
        UPDATE swatch_jobs SET scenario_job_id = ${inferenceId}, updated_at = NOW()
        WHERE id = ${jobId}
      `;

      const result = await pollUntilComplete(inferenceId);

      if (!result.assets || result.assets.length === 0) {
        throw new Error('Scenario did not return PBR maps');
      }

      // Download and upload each map to R2
      const mapUrls: Record<string, string> = {
        albedo: seamlessAlbedoUrl,
      };

      const mapTypeMapping: Record<string, string> = {
        normal: 'normal_2k.png',
        height: 'height_2k.png',
        smoothness: 'roughness_2k.png', // Scenario outputs smoothness, we use as roughness
        metallic: 'metallic_2k.png',
        ao: 'ao_2k.png',
        edge: 'edge_2k.png',
      };

      for (const asset of result.assets) {
        const mapType = asset.type || 'unknown';
        const filename = mapTypeMapping[mapType];
        if (!filename) continue;

        const mapBuffer = await downloadAsset(asset.url);
        const key = `materials/swatch/${jobId}/${filename}`;
        mapUrls[mapType] = await uploadTexture(mapBuffer, key);
      }

      return mapUrls;
    });

    // Step 5: Create material record
    const materialId = await step.run('create-material', async () => {
      const [job] = await sql`SELECT * FROM swatch_jobs WHERE id = ${jobId}`;
      const visionAnalysis = job.vision_analysis as any;

      const materialName = job.material_name
        || `${visionAnalysis?.color_description || ''} ${visionAnalysis?.material_subcategory || 'material'}`.trim();
      const materialType = job.derived_material_type || 'custom';
      const tags = (job.derived_tags || []) as string[];

      const [material] = await sql`
        INSERT INTO materials (
          name, material_type, source,
          albedo_url, normal_url, roughness_url, metallic_url, ao_url, height_url,
          preview_url, manufacturer_name, manufacturer_sku, color_hex, tags
        ) VALUES (
          ${materialName},
          ${materialType},
          'swatch'::material_source,
          ${pbrMapUrls.albedo || null},
          ${pbrMapUrls.normal || null},
          ${pbrMapUrls.smoothness || null},
          ${pbrMapUrls.metallic || null},
          ${pbrMapUrls.ao || null},
          ${pbrMapUrls.height || null},
          ${pbrMapUrls.albedo || null},
          ${job.manufacturer_name || null},
          ${job.manufacturer_sku || null},
          ${visionAnalysis?.color_primary || null},
          ${tags}
        )
        RETURNING id
      `;

      await sql`
        UPDATE swatch_jobs
        SET status = 'review',
            material_id = ${material.id},
            updated_at = NOW()
        WHERE id = ${jobId}
      `;

      return material.id;
    });

    return { jobId, materialId, status: 'review' };
  },
);
