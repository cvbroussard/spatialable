import type { MeshyCreateParams, MeshyMultiImageParams, MeshyTaskResult } from './types';

const MESHY_API_BASE = 'https://api.meshy.ai/openapi/v1';

function getApiKey(): string {
  const key = process.env.MESHY_API_KEY;
  if (!key) throw new Error('MESHY_API_KEY not set');
  return key;
}

async function meshyFetch(path: string, options: RequestInit = {}): Promise<any> {
  const response = await fetch(`${MESHY_API_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Meshy API ${response.status}: ${body}`);
  }

  return response.json();
}

/**
 * Submit an image for 3D model generation.
 * Returns the Meshy task ID.
 */
export async function createImageTo3D(params: MeshyCreateParams): Promise<string> {
  const body = {
    image_url: params.image_url,
    enable_pbr: params.enable_pbr ?? true,
    topology: params.topology ?? 'triangle',
    target_polycount: params.target_polycount ?? 30000,
  };

  const result = await meshyFetch('/image-to-3d', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return result.result;
}

/**
 * Submit multiple images (1-4) for 3D model generation.
 * Better geometry from multiple angles.
 */
export async function createMultiImageTo3D(params: MeshyMultiImageParams): Promise<string> {
  const body = {
    image_urls: params.image_urls,
    enable_pbr: params.enable_pbr ?? true,
    topology: params.topology ?? 'triangle',
    target_polycount: params.target_polycount ?? 30000,
  };

  const result = await meshyFetch('/multi-image-to-3d', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return result.result;
}

/**
 * Get the status of a generation task.
 */
export async function getTask(taskId: string): Promise<MeshyTaskResult> {
  return meshyFetch(`/image-to-3d/${taskId}`);
}

/**
 * Poll until the task completes or fails.
 * Use inside Inngest steps for durable execution.
 */
export async function pollUntilComplete(
  taskId: string,
  intervalMs = 10000,
  maxAttempts = 120,
): Promise<MeshyTaskResult> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const result = await getTask(taskId);

    if (result.status === 'SUCCEEDED') return result;
    if (result.status === 'FAILED') {
      throw new Error(`Meshy generation failed: ${result.task_error?.message || 'Unknown error'}`);
    }
    if (result.status === 'CANCELED') {
      throw new Error('Meshy generation was canceled');
    }

    attempts++;
    await new Promise(r => setTimeout(r, intervalMs));
  }

  throw new Error(`Meshy generation timed out after ${maxAttempts} attempts`);
}

/**
 * Check if Meshy is configured.
 */
export function isMeshyConfigured(): boolean {
  return !!process.env.MESHY_API_KEY;
}
