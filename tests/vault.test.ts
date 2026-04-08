/**
 * Unit Tests: Vault Encryption (Node.js version)
 * Tests encrypt/decrypt roundtrip + isEncrypted detection
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { encrypt, decrypt, isEncrypted } from '../src/worker/utils/vault';

beforeAll(() => {
  // Set test encryption key (32 bytes hex = 64 chars)
  process.env.VAULT_ENCRYPTION_KEY = 'a'.repeat(64);
});

describe('Vault Encrypt/Decrypt', () => {
  it('roundtrips a simple string', () => {
    const plaintext = 'hello world';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('roundtrips a JSON cookie string', () => {
    const cookies = JSON.stringify([
      { name: 'li_at', value: 'abc123', domain: '.linkedin.com' },
      { name: 'JSESSIONID', value: 'xyz789', domain: '.linkedin.com' },
    ]);
    const encrypted = encrypt(cookies);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(cookies);
  });

  it('roundtrips Chinese text', () => {
    const text = '这是一个测试的中文字符串，包含特殊字符：！@#￥';
    const encrypted = encrypt(text);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(text);
  });

  it('produces different ciphertext each time (unique IV)', () => {
    const plaintext = 'same input';
    const e1 = encrypt(plaintext);
    const e2 = encrypt(plaintext);
    expect(e1).not.toBe(e2);
    // Both decrypt to same value
    expect(decrypt(e1)).toBe(plaintext);
    expect(decrypt(e2)).toBe(plaintext);
  });

  it('encrypted output starts with v1: prefix', () => {
    const encrypted = encrypt('test');
    expect(encrypted.startsWith('v1:')).toBe(true);
  });
});

describe('isEncrypted', () => {
  it('detects v1: prefixed strings', () => {
    const encrypted = encrypt('test');
    expect(isEncrypted(encrypted)).toBe(true);
  });

  it('rejects plain JWT tokens', () => {
    expect(isEncrypted('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc')).toBe(false);
  });

  it('rejects plain cookie strings', () => {
    expect(isEncrypted('li_at=abc123; JSESSIONID=xyz789')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isEncrypted('')).toBe(false);
  });
});
