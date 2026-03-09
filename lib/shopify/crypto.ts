import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// ---------------------------------------------------------------------------
// AES-256-GCM encryption for Shopify access tokens at rest
//
// Key: SHOPIFY_TOKEN_KEY env var (32-byte hex = 64 hex chars)
// ---------------------------------------------------------------------------

function getKey(): Buffer {
  const hex = process.env.SHOPIFY_TOKEN_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('SHOPIFY_TOKEN_KEY must be a 64-char hex string (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypt a Shopify access token for storage.
 * Returns the encrypted ciphertext and initialization vector (both base64).
 */
export function encryptToken(plaintext: string): { encrypted: string; iv: string } {
  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  // Append auth tag to ciphertext
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([Buffer.from(encrypted, 'base64'), authTag]);

  return {
    encrypted: combined.toString('base64'),
    iv: iv.toString('base64'),
  };
}

/**
 * Decrypt a stored Shopify access token.
 */
export function decryptToken(encrypted: string, iv: string): string {
  const key = getKey();
  const ivBuf = Buffer.from(iv, 'base64');
  const combined = Buffer.from(encrypted, 'base64');

  // Last 16 bytes are the auth tag
  const authTag = combined.subarray(combined.length - 16);
  const ciphertext = combined.subarray(0, combined.length - 16);

  const decipher = createDecipheriv('aes-256-gcm', key, ivBuf);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, undefined, 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
