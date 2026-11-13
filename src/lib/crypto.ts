import type { Cipher, VaultMeta } from './types';

// Passwords never leave the device and are never stored. A key is derived from
// the master password with PBKDF2 and held in memory only while unlocked.
export const KDF_ITERATIONS = 600_000;
const CHECK_TEXT = 'subscription-payments:vault';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(s);
}

export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(n));
}

export async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password.normalize('NFKC')), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptText(key: CryptoKey, text: string): Promise<Cipher> {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(text));
  return { iv: toBase64(iv), ct: toBase64(new Uint8Array(ct)) };
}

/** Throws when the key is wrong or the data was tampered with. */
export async function decryptText(key: CryptoKey, cipher: Cipher): Promise<string> {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(cipher.iv) }, key, fromBase64(cipher.ct));
  return decoder.decode(pt);
}

export async function createVault(
  password: string,
  iterations = KDF_ITERATIONS,
): Promise<{ meta: VaultMeta; key: CryptoKey }> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, iterations);
  const check = await encryptText(key, CHECK_TEXT);
  return { meta: { v: 1, salt: toBase64(salt), iter: iterations, check }, key };
}

/** Returns the key, or null when the password is wrong. */
export async function openVault(password: string, meta: VaultMeta): Promise<CryptoKey | null> {
  try {
    const key = await deriveKey(password, fromBase64(meta.salt), meta.iter);
    return (await decryptText(key, meta.check)) === CHECK_TEXT ? key : null;
  } catch {
    return null;
  }
}

export function isVaultMeta(v: unknown): v is VaultMeta {
  if (!v || typeof v !== 'object') return false;
  const m = v as Record<string, unknown>;
  return (
    m.v === 1 &&
    typeof m.salt === 'string' &&
    typeof m.iter === 'number' &&
    m.iter >= 1000 &&
    m.iter <= 10_000_000 &&
    isCipher(m.check)
  );
}

export function isCipher(v: unknown): v is Cipher {
  if (!v || typeof v !== 'object') return false;
  const c = v as Record<string, unknown>;
  return typeof c.iv === 'string' && typeof c.ct === 'string';
}

export function sameVault(a: VaultMeta | null, b: VaultMeta | null): boolean {
  return !!a && !!b && a.salt === b.salt && a.check.ct === b.check.ct;
}

const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*-_=+?';

/** Unbiased random integer in [0, max). */
function randomInt(max: number): number {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % max;
}

/** Look-alike characters (l, I, O, 0, 1) are left out on purpose. */
export function generatePassword(length = 20, symbols = true): string {
  const sets = symbols ? [LOWER, UPPER, DIGITS, SYMBOLS] : [LOWER, UPPER, DIGITS];
  const all = sets.join('');
  const len = Math.max(sets.length, Math.min(64, length));
  const chars = sets.map((s) => s[randomInt(s.length)]);
  while (chars.length < len) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = randomBytes(16);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}
