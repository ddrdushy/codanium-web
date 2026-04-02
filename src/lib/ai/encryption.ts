// =============================================================================
// Codanium — API Key Encryption Utility
// =============================================================================
// AES-256-GCM encryption for storing API keys at rest. Keys are encrypted
// before being persisted to the database and decrypted only when needed to
// make an LLM API call.
//
// The encryption key is read from the LLM_ENCRYPTION_KEY environment variable.
// Supported formats: base64 (preferred), hex (64 chars), or raw UTF-8 string.
// In development mode without a key, a deterministic fallback is used.
// =============================================================================

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits, recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

// ---------------------------------------------------------------------------
// Key Derivation
// ---------------------------------------------------------------------------

/**
 * Resolve the 32-byte encryption key from the environment.
 *
 * Supports multiple formats:
 *   - Base64-encoded 32 bytes (preferred for production)
 *   - 64-character hex string
 *   - Raw UTF-8 string (padded/truncated to 32 bytes)
 *   - Missing key: deterministic dev fallback (NOT safe for production)
 */
function getEncryptionKey(): Buffer {
  const key = process.env.LLM_ENCRYPTION_KEY;

  if (!key) {
    // In dev mode without a key, use a deterministic fallback.
    // This is intentionally weak — the build/startup should warn about it.
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[encryption] WARNING: LLM_ENCRYPTION_KEY is not set in production! ' +
          'API keys will be encrypted with a weak fallback key.',
      );
    }
    return Buffer.from('dev-encryption-key-32-bytes!!!!!'); // exactly 32 bytes
  }

  // Try base64 first
  const decoded = Buffer.from(key, 'base64');
  if (decoded.length === 32) return decoded;

  // Try hex (64 hex chars = 32 bytes)
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, 'hex');
  }

  // Fall back to raw UTF-8, padded or truncated to exactly 32 bytes
  const padded = Buffer.alloc(32);
  Buffer.from(key, 'utf8').copy(padded);
  return padded;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * Returns a string in the format: `iv:authTag:ciphertext` (all base64-encoded).
 * This format is self-contained — the IV and auth tag are needed for decryption
 * and are safe to store alongside the ciphertext.
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/**
 * Decrypt a string that was encrypted with `encrypt()`.
 *
 * Expects the format: `iv:authTag:ciphertext` (all base64-encoded).
 * Throws if the format is invalid or the auth tag verification fails
 * (indicating tampering or a wrong key).
 */
export function decrypt(encryptedString: string): string {
  const parts = encryptedString.split(':');
  if (parts.length !== 3) {
    throw new Error(
      'Invalid encrypted format: expected iv:authTag:ciphertext',
    );
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const encrypted = Buffer.from(parts[2], 'base64');

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH}, got ${iv.length}`);
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(
      `Invalid auth tag length: expected ${AUTH_TAG_LENGTH}, got ${authTag.length}`,
    );
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Check whether a string looks like it was encrypted by `encrypt()`.
 * This is a format check only — it does not verify the key or auth tag.
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split(':');
  if (parts.length !== 3) return false;

  try {
    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    return iv.length === IV_LENGTH && authTag.length === AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
}
