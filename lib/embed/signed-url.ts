import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ---------------------------------------------------------------------------
// R2 Presigned URL Generation
//
// Generates time-limited URLs for piracy-protected asset delivery.
// URLs expire after TTL — components re-resolve on next interaction.
// ---------------------------------------------------------------------------

const ASSETS_BUCKET = process.env.R2_ASSETS_BUCKET || 'spatialable-assets';
const DEFAULT_TTL = 3600; // 1 hour

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      },
      // R2 doesn't support AWS SDK v3's checksum extensions.
      // Without these, the SDK adds x-amz-checksum-mode=ENABLED to presigned URLs,
      // which R2 rejects with InvalidArgument Authorization.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }
  return _client;
}

/**
 * Generate a presigned URL for an R2 asset key.
 *
 * @param key - R2 object key (e.g., "assets/{jobId}/model.glb")
 * @param ttl - Time to live in seconds (default: 3600)
 * @returns Presigned URL string
 */
export async function generateSignedUrl(key: string, ttl: number = DEFAULT_TTL): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: ASSETS_BUCKET,
    Key: key,
  });

  return getSignedUrl(getClient(), command, { expiresIn: ttl });
}

/**
 * Extract R2 key from a full CDN URL.
 * "https://cdn.assets.spatialable.com/assets/abc/model.glb" → "assets/abc/model.glb"
 */
export function extractKeyFromUrl(url: string): string | null {
  const assetsUrl = process.env.R2_ASSETS_URL || 'https://cdn.assets.spatialable.com';
  if (url.startsWith(assetsUrl)) {
    return url.slice(assetsUrl.length + 1); // +1 for trailing slash
  }
  return null;
}
