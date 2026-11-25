import { scrypt, scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

// scrypt (N=16384, r=8, p=1) with a random 16-byte salt per password. Stored as
// "scrypt$<salt hex>$<hash hex>" — the plaintext password is never stored.
const scryptAsync = promisify(scrypt);
const KEYLEN = 64;

/** Synchronous variant — only for one-off seeding at startup. */
export function hashPasswordSync(pw) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${scryptSync(String(pw), salt, KEYLEN).toString('hex')}`;
}

/** Async hashing keeps the event loop free while requests are served. */
export async function hashPassword(pw) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(String(pw), salt, KEYLEN);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verifyPassword(pw, stored) {
  const [, saltHex, hashHex] = String(stored).split('$');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scryptAsync(String(pw), Buffer.from(saltHex, 'hex'), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// Used when the email does not exist, so a failed login always costs one scrypt
// (prevents discovering registered emails through response timing).
export const DUMMY_HASH = hashPasswordSync(randomBytes(12).toString('hex'));

export const newToken = () => randomBytes(32).toString('base64url');
