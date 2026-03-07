import type { TripoCreateParams, TripoMultiviewParams, TripoTaskResult } from './types';

const TRIPO_API_BASE = 'https://api.tripo3d.ai/v2/openapi';

function getApiKey(): string {
  const key = process.env.TRIPO_API_KEY;
  if (!key) throw new Error('TRIPO_API_KEY not set');
  return key;
}

async function tripoFetch(path: string, options: RequestInit = {}): Promise<any> {
  const response = await fetch(`${TRIPO_API_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Tripo API ${response.status}: ${body}`);
  }

  const json = await response.json();
  if (json.code !== 0) {
    throw new Error(`Tripo API error: ${json.message || JSON.stringify(json)}`);
  }

  return json.data;
}

/**
 * Upload an image from URL to Tripo, returning a file token.
 * Tripo requires images to be uploaded first for the direct API.
 * Alternative: pass URL directly in the task if supported.
 */
async function uploadImageFromUrl(imageUrl: string): Promise<{ token: string; ext: string }> {
  // Download the image (follow redirects)
  const imageResponse = await fetch(imageUrl, { redirect: 'follow' });
  if (!imageResponse.ok) {
    throw new Error(`Failed to download image: ${imageResponse.status}`);
  }
  const imageBuffer = await imageResponse.arrayBuffer();
  const buf = Buffer.from(imageBuffer);

  // Detect actual image type from magic bytes
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50;
  const isWebp = buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;

  if (!isJpeg && !isPng && !isWebp) {
    throw new Error(`Downloaded file is not a valid image (first bytes: ${buf.slice(0, 4).toString('hex')})`);
  }

  const ext = isPng ? 'png' : isWebp ? 'webp' : 'jpg';
  const contentType = isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg';

  // Upload to Tripo
  const formData = new FormData();
  formData.append('file', new Blob([imageBuffer], { type: contentType }), `image.${ext}`);

  const response = await fetch(`${TRIPO_API_BASE}/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Tripo upload ${response.status}: ${body}`);
  }

  const json = await response.json();
  if (json.code !== 0) {
    throw new Error(`Tripo upload error: ${json.message || JSON.stringify(json)}`);
  }

  return { token: json.data.image_token, ext };
}

/**
 * Submit a single image for 3D model generation.
 * Returns the Tripo task ID.
 */
export async function createImageTo3D(params: TripoCreateParams): Promise<string> {
  const { token, ext } = await uploadImageFromUrl(params.image_url);

  const body: Record<string, any> = {
    type: 'image_to_model',
    model_version: 'v2.5-20250123',
    file: { type: ext, file_token: token },
  };

  console.log('[tripo] Creating task:', JSON.stringify(body));

  const data = await tripoFetch('/task', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return data.task_id;
}

/**
 * Submit multiple images for 3D model generation.
 * Returns the Tripo task ID.
 */
export async function createMultiImageTo3D(params: TripoMultiviewParams): Promise<string> {
  // Upload all images and collect tokens
  const uploads = await Promise.all(
    params.image_urls.map((url) => uploadImageFromUrl(url)),
  );

  const body: Record<string, any> = {
    type: 'multiview_to_model',
    files: uploads.map((u) => ({ type: u.ext, file_token: u.token })),
    face_limit: params.face_limit ?? 30000,
    texture: params.texture ?? 'standard',
    auto_size: params.auto_size ?? false,
    quad: params.quad ?? false,
  };

  const data = await tripoFetch('/task', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return data.task_id;
}

/**
 * Get the status of a generation task.
 */
export async function getTask(taskId: string): Promise<TripoTaskResult> {
  return tripoFetch(`/task/${taskId}`);
}

/**
 * Poll until the task completes or fails.
 */
export async function pollUntilComplete(
  taskId: string,
  intervalMs = 5000,
  maxAttempts = 240,
): Promise<TripoTaskResult> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const result = await getTask(taskId);

    if (result.status === 'success') return result;
    if (result.status === 'failed') {
      throw new Error('Tripo generation failed');
    }

    attempts++;
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(`Tripo generation timed out after ${maxAttempts} attempts`);
}

/**
 * Check if Tripo is configured.
 */
export function isTripoConfigured(): boolean {
  return !!process.env.TRIPO_API_KEY;
}
