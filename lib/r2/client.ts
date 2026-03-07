import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

// ---------------------------------------------------------------------------
// R2 Client — shared across both buckets (same account, same API key)
// ---------------------------------------------------------------------------

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

// ---------------------------------------------------------------------------
// Buckets
// ---------------------------------------------------------------------------

const ASSETS_BUCKET = process.env.R2_ASSETS_BUCKET || 'spatialable-assets';
const ASSETS_URL = process.env.R2_ASSETS_URL || 'https://cdn.assets.spatialable.com';

const PIPELINE_BUCKET = process.env.R2_PIPELINE_BUCKET || 'spatialable-pipeline';
const PIPELINE_URL = process.env.R2_PIPELINE_URL || 'https://cdn.pipeline.spatialable.com';

// ---------------------------------------------------------------------------
// Key generators
// ---------------------------------------------------------------------------

export function generateAssetKey(jobId: string, filename: string): string {
  return `assets/${jobId}/${filename}`;
}

export function generateMaterialKey(materialId: number, mapType: string): string {
  return `materials/${materialId}/${mapType}`;
}

export function generatePipelineKey(jobId: string, filename: string): string {
  return `jobs/${jobId}/${filename}`;
}

// ---------------------------------------------------------------------------
// Upload — Assets bucket (finished deliverables, public, immutable)
// ---------------------------------------------------------------------------

export async function uploadGlb(buffer: Buffer, key: string): Promise<string> {
  await r2Client.send(new PutObjectCommand({
    Bucket: ASSETS_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: 'model/gltf-binary',
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  return `${ASSETS_URL}/${key}`;
}

export async function uploadTexture(buffer: Buffer, key: string, contentType = 'image/png'): Promise<string> {
  await r2Client.send(new PutObjectCommand({
    Bucket: ASSETS_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  return `${ASSETS_URL}/${key}`;
}

export async function uploadAssetFile(buffer: Buffer, key: string, contentType: string): Promise<string> {
  await r2Client.send(new PutObjectCommand({
    Bucket: ASSETS_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  return `${ASSETS_URL}/${key}`;
}

// ---------------------------------------------------------------------------
// Upload — Pipeline bucket (intermediate artifacts, private, ephemeral)
// ---------------------------------------------------------------------------

export async function uploadPipelineFile(buffer: Buffer, key: string, contentType: string): Promise<string> {
  await r2Client.send(new PutObjectCommand({
    Bucket: PIPELINE_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
  return `${PIPELINE_URL}/${key}`;
}

// ---------------------------------------------------------------------------
// Download (for transferring Meshy output to R2)
// ---------------------------------------------------------------------------

export async function downloadToBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ---------------------------------------------------------------------------
// Util
// ---------------------------------------------------------------------------

export function getAssetUrl(key: string): string {
  return `${ASSETS_URL}/${key}`;
}

export function getPipelineUrl(key: string): string {
  return `${PIPELINE_URL}/${key}`;
}

export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY
  );
}
