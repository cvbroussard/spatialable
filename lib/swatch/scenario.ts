import type { ScenarioJobResult, ScenarioAsset } from './types';

const SCENARIO_API_BASE = 'https://api.cloud.scenario.com/v1';

function getApiKey(): string {
  const key = process.env.SCENARIO_API_KEY;
  if (!key) throw new Error('SCENARIO_API_KEY not set');
  return key;
}

async function scenarioFetch(path: string, options: RequestInit = {}): Promise<any> {
  const response = await fetch(`${SCENARIO_API_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Scenario API ${response.status}: ${body}`);
  }

  return response.json();
}

/**
 * Upload an image buffer to Scenario as an asset.
 * Returns the asset ID for use in generation calls.
 */
export async function uploadAsset(
  buffer: Buffer,
  filename: string,
): Promise<string> {
  const formData = new FormData();
  const arrayBuf = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  formData.append('file', new Blob([arrayBuf], { type: 'image/png' }), filename);

  const response = await fetch(`${SCENARIO_API_BASE}/assets`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Scenario upload ${response.status}: ${body}`);
  }

  const json = await response.json();
  return json.asset?.id || json.id;
}

/**
 * Generate a seamless tileable texture from a reference image.
 * Uses Scenario's img2img-texture endpoint.
 * Returns the job/inference ID.
 */
export async function generateSeamlessTexture(
  assetId: string,
  prompt: string,
): Promise<string> {
  const data = await scenarioFetch('/generate/img2img-texture', {
    method: 'POST',
    body: JSON.stringify({
      image: assetId,
      prompt,
      numSamples: 1,
      width: 2048,
      height: 2048,
    }),
  });

  return data.inference?.id || data.id;
}

/**
 * Generate PBR maps (normal, height, roughness, metallic, AO, edge) from an albedo texture.
 * Uses Scenario's texture derivation endpoint.
 * Returns the job/inference ID.
 */
export async function generatePbrMaps(assetId: string): Promise<string> {
  const data = await scenarioFetch('/generate/texture', {
    method: 'POST',
    body: JSON.stringify({
      image: assetId,
      maps: ['normal', 'height', 'smoothness', 'metallic', 'ao', 'edge'],
    }),
  });

  return data.inference?.id || data.id;
}

/**
 * Get the current status of a generation job.
 */
export async function getJob(jobId: string): Promise<ScenarioJobResult> {
  const data = await scenarioFetch(`/inferences/${jobId}`);
  const inference = data.inference || data;

  return {
    id: inference.id,
    status: inference.status,
    assets: inference.images?.map((img: any) => ({
      id: img.id || img.assetId,
      url: img.url,
      type: img.type || img.mapType,
    })) as ScenarioAsset[] | undefined,
    error: inference.error,
  };
}

/**
 * Poll until the job completes or fails.
 */
export async function pollUntilComplete(
  jobId: string,
  intervalMs = 5000,
  maxAttempts = 120,
): Promise<ScenarioJobResult> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const result = await getJob(jobId);

    if (result.status === 'succeeded') return result;
    if (result.status === 'failed') {
      throw new Error(`Scenario generation failed: ${result.error || 'unknown error'}`);
    }

    attempts++;
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(`Scenario generation timed out after ${maxAttempts} attempts`);
}

/**
 * Download an asset image by URL.
 */
export async function downloadAsset(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download Scenario asset: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Check if Scenario is configured.
 */
export function isScenarioConfigured(): boolean {
  return !!process.env.SCENARIO_API_KEY;
}
