/**
 * Application-level AES-256-GCM encryption for session tokens.
 * Deno Web Crypto API version (Edge Functions).
 *
 * Output format: "v1:" + base64(iv + ciphertext + tag)
 * Key: 32-byte hex string from VAULT_ENCRYPTION_KEY env var.
 *
 * The Node.js worker uses an identical format in src/worker/utils/vault.ts.
 */

const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const PREFIX = 'v1:';

let _cachedKey: CryptoKey | undefined;

async function getKey(): Promise<CryptoKey> {
  if (_cachedKey) return _cachedKey;
  const hexKey = Deno.env.get('VAULT_ENCRYPTION_KEY');
  console.log(`[vault-edge] VAULT_ENCRYPTION_KEY: ${hexKey ? 'loaded' : 'MISSING'} (len: ${hexKey?.length || 0})`);
  if (!hexKey || hexKey.length !== 64) {
    throw new Error('VAULT_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  const keyBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    keyBytes[i] = parseInt(hexKey.substring(i * 2, i * 2 + 2), 16);
  }
  _cachedKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  return _cachedKey;
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertextWithTag = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: TAG_LENGTH * 8 },
    key,
    encoded,
  );

  const combined = new Uint8Array(IV_LENGTH + ciphertextWithTag.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertextWithTag), IV_LENGTH);

  // Use chunked approach to avoid stack overflow on large tokens
  let binary = '';
  for (let i = 0; i < combined.length; i++) binary += String.fromCharCode(combined[i]);
  return PREFIX + btoa(binary);
}

export async function decrypt(encrypted: string): Promise<string> {
  // Strip version prefix
  const base64 = encrypted.startsWith(PREFIX) ? encrypted.slice(PREFIX.length) : encrypted;

  const key = await getKey();
  const combined = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

  if (combined.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error('VAULT_DECRYPT_ERROR: Ciphertext too short');
  }

  const iv = combined.slice(0, IV_LENGTH);
  const ciphertextWithTag = combined.slice(IV_LENGTH);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: TAG_LENGTH * 8 },
    key,
    ciphertextWithTag,
  );

  return new TextDecoder().decode(decrypted);
}

/** Check if a value was encrypted by this module (has v1: prefix). */
export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}
