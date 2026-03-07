import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, isEncrypted } from './encryption';

describe('encrypt / decrypt', () => {
  it('round-trips a simple string', () => {
    const original = 'sk-test-api-key-12345';
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it('round-trips an empty string', () => {
    const encrypted = encrypt('');
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe('');
  });

  it('round-trips a long string', () => {
    const original = 'A'.repeat(10000);
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it('round-trips unicode characters', () => {
    const original = '密码🔑パスワード';
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it('produces different ciphertext for same input (random IV)', () => {
    const original = 'test-key';
    const encrypted1 = encrypt(original);
    const encrypted2 = encrypt(original);
    expect(encrypted1).not.toBe(encrypted2);
    // Both should decrypt to the same value
    expect(decrypt(encrypted1)).toBe(original);
    expect(decrypt(encrypted2)).toBe(original);
  });

  it('output has iv:authTag:ciphertext format', () => {
    const encrypted = encrypt('test');
    const parts = encrypted.split(':');
    expect(parts.length).toBe(3);
    // Each part should be a valid base64 string
    for (const part of parts) {
      expect(part.length).toBeGreaterThan(0);
    }
  });
});

describe('decrypt error handling', () => {
  it('throws on invalid format (wrong number of parts)', () => {
    expect(() => decrypt('invalid')).toThrow('Invalid encrypted format');
    expect(() => decrypt('a:b')).toThrow('Invalid encrypted format');
    expect(() => decrypt('a:b:c:d')).toThrow('Invalid encrypted format');
  });

  it('throws on invalid IV length', () => {
    // Create a string with wrong IV length
    const badIv = Buffer.from('short').toString('base64');
    const authTag = Buffer.alloc(16).toString('base64');
    const cipher = Buffer.from('test').toString('base64');
    expect(() => decrypt(`${badIv}:${authTag}:${cipher}`)).toThrow('Invalid IV length');
  });
});

describe('isEncrypted', () => {
  it('returns true for encrypted strings', () => {
    const encrypted = encrypt('test');
    expect(isEncrypted(encrypted)).toBe(true);
  });

  it('returns false for plain strings', () => {
    expect(isEncrypted('sk-1234567890')).toBe(false);
    expect(isEncrypted('just a regular string')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isEncrypted('')).toBe(false);
  });

  it('returns false for strings with wrong format', () => {
    expect(isEncrypted('a:b')).toBe(false);
    expect(isEncrypted('not:encrypted:properly')).toBe(false);
  });
});
