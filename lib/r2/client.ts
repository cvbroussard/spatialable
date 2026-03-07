import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

// ---------------------------------------------------------------------------
// R2 Client
// ---------------------------------------------------------------------------

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'spatialable-assets';
const PUBLIC_URL = process.env.R2_PUBLIC_URL || `https://${BUCKET_NAME}.r2.dev`;

// ---------------------------------------------------------------------------
// Key generators
// ---------------------------------------------------------------------------

export function generateAssetKey(jobId: string, filename: string): string {
  return `assets/${jobId}/${filename}`;
}

export function generateMaterialKey(materialId: number, mapType: string): string {
  return `materials/${materialId}/${mapType}`;
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

export async function uploadGlb(buffer: Buffer, key: string): Promise<string> {
  await r2Client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: 'model/gltf-binary',
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  return `${PUBLIC_URL}/${key}`;
}

export async function uploadTexture(buffer: Buffer, key: string, contentType = 'image/png'): Promise<string> {
  await r2Client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  return `${PUBLIC_URL}/${key}`;
}

export async function uploadFile(buffer: Buffer, key: string, contentType: string): Promise<string> {
  await r2Client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  return `${PUBLIC_URL}/${key}`;
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

export function getPublicUrl(key: string): string {
  return `${PUBLIC_URL}/${key}`;
}

export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY
  );
}
