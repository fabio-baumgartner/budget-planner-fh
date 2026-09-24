import { scrypt, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scryptAsync(password, salt, KEY_LENGTH);
  return { salt, passwordHash: key.toString('hex') };
}

export async function verifyPassword(password, salt, passwordHash) {
  const key = await scryptAsync(password, salt, KEY_LENGTH);
  const expected = Buffer.from(passwordHash, 'hex');
  return expected.length === key.length && timingSafeEqual(key, expected);
}

// Die E-Mail selbst taucht nicht im Blob-Pfad auf, nur ihr Hash.
export function hashEmail(email) {
  return createHash('sha256').update(normalizeEmail(email)).digest('hex');
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}
