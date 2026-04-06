/**
 * Application-level AES-256-GCM encryption for session tokens.
 * Node.js crypto version (Fly.io worker).
 *
 * Output format: "v1:" + base64(iv + ciphertext + tag)
 * Identical format to supabase/functions/_shared/vault.ts (Deno version).
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const ALGORITHM = 'aes-256-gcm';
const PREFIX = 'v1:';

let _cachedKey: Buffer | undefined;

function getKeyBuffer(): Buffer {
  if (_cachedKey) return _cachedKey;
  const hexKey = process.env.VAULT_ENCRYPTION_KEY;
  console.log(`[vault] VAULT_ENCRYPTION_KEY: ${hexKey ? 'loaded' : 'MISSING'} (length: ${hexKey?.length || 0})`);
  if (!hexKey || hexKey.length !== 64) {
    throw new Error('VAULT_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  _cachedKey = Buffer.from(hexKey, 'hex');
  return _cachedKey;
}

export function encrypt(plaintext: string): string {
  const key = getKeyBuffer();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, encrypted, tag]);
  return PREFIX + combined.toString('base64');
}

export function decrypt(encryptedBase64: string): string {
  // Strip version prefix
  const base64 = encryptedBase64.startsWith(PREFIX) ? encryptedBase64.slice(PREFIX.length) : encryptedBase64;

  const key = getKeyBuffer();
  const combined = Buffer.from(base64, 'base64');

  if (combined.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error('VAULT_DECRYPT_ERROR: Ciphertext too short');
  }

  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(combined.length - TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}
