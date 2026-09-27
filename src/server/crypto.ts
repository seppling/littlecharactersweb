/**
 * Field-level encryption for sensitive notes (allergies, medical info).
 * AES-256-GCM with a key from DATA_ENCRYPTION_KEY, so a leaked database dump
 * doesn't expose children's health information.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { config, isProd } from './env';

let key: Buffer | undefined;

function getKey() {
  if (key) return key;
  if (config.dataEncryptionKey) {
    key = Buffer.from(config.dataEncryptionKey, 'base64');
    if (key.length !== 32) throw new Error('DATA_ENCRYPTION_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32).');
  } else {
    if (isProd) throw new Error('DATA_ENCRYPTION_KEY is required in production.');
    // Development only: a fixed key so local data survives restarts.
    key = createHash('sha256').update('little-characters-dev-only-key').digest();
  }
  return key;
}

/** Returns "v1:<iv>:<tag>:<ciphertext>" (base64 parts), or null for empty input. */
export function encrypt(plain: string | null | undefined): string | null {
  const text = plain?.trim();
  if (!text) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}

export function decrypt(payload: string | null | undefined): string {
  if (!payload) return '';
  const [version, iv, tag, data] = payload.split(':');
  if (version !== 'v1') throw new Error('Unknown encryption format');
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}
