import { db, kvGet, kvSet } from './db';
import { decryptText, encryptText, isCipher, isVaultMeta, openVault, sameVault } from './crypto';
import { DEFAULT_CATEGORIES, FALLBACK_CATEGORY } from './categories';
import { isValidISO } from './dates';
import { isCurrency } from './money';
import { sameCycle } from './schedule';
import { loadSettings, patchSettings } from './settings';
import type { Category, Cipher, Cycle, Payment, PricePoint, Settings, Subscription, VaultMeta } from './types';

export const BACKUP_APP = 'subscription-payments';
export const BACKUP_FORMAT = 1;

export interface BackupData {
  subscriptions: Subscription[];
  categories: Category[];
  settings: Partial<Settings>;
  /** Needed to decrypt the stored passwords; contains no secret by itself. */
  vault: VaultMeta | null;
}

interface PlainFile {
  app: typeof BACKUP_APP;
  format: number;
  exportedAt: string;
  encrypted: false;
  data: BackupData;
}

export interface EncryptedFile {
  app: typeof BACKUP_APP;
  format: number;
  exportedAt: string;
  encrypted: true;
  vault: VaultMeta;
  payload: Cipher;
}

export type ParsedBackup =
  | { kind: 'plain'; exportedAt: string | null; data: BackupData }
  | { kind: 'encrypted'; exportedAt: string | null; file: EncryptedFile };

export class BackupError extends Error {
  constructor(public code: 'invalid' | 'newer' | 'password') {
    super(code);
  }
}

export async function collectBackup(): Promise<BackupData> {
  const [subscriptions, categories, settings, vault] = await Promise.all([
    db.subs.toArray(),
    db.categories.orderBy('order').toArray(),
    loadSettings(),
    kvGet<VaultMeta>('vault'),
  ]);
  return { subscriptions, categories, settings: portableSettings(settings), vault: vault ?? null };
}

/** Stored passwords stay encrypted in this file; everything else is readable. */
export function serializePlain(data: BackupData, now = new Date()): string {
  const file: PlainFile = { app: BACKUP_APP, format: BACKUP_FORMAT, exportedAt: now.toISOString(), encrypted: false, data };
  return JSON.stringify(file, null, 2);
}

/** Encrypts the whole file with the vault key, so the master password opens it. */
export async function serializeEncrypted(data: BackupData, vault: VaultMeta, key: CryptoKey, now = new Date()): Promise<string> {
  const file: EncryptedFile = {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    exportedAt: now.toISOString(),
    encrypted: true,
    vault,
    payload: await encryptText(key, JSON.stringify(data)),
  };
  return JSON.stringify(file);
}

export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('invalid');
  }
  if (!raw || typeof raw !== 'object') throw new BackupError('invalid');
  const file = raw as Record<string, unknown>;
  if (file.app !== BACKUP_APP || typeof file.format !== 'number') throw new BackupError('invalid');
  if (file.format > BACKUP_FORMAT) throw new BackupError('newer');
  const exportedAt = typeof file.exportedAt === 'string' ? file.exportedAt : null;
  if (file.encrypted === true) {
    if (!isVaultMeta(file.vault) || !isCipher(file.payload)) throw new BackupError('invalid');
    return { kind: 'encrypted', exportedAt, file: file as unknown as EncryptedFile };
  }
  return { kind: 'plain', exportedAt, data: sanitizeData(file.data) };
}

export async function decryptBackup(file: EncryptedFile, password: string): Promise<{ data: BackupData; key: CryptoKey }> {
  const key = await openVault(password, file.vault);
  if (!key) throw new BackupError('password');
  let raw: unknown;
  try {
    raw = JSON.parse(await decryptText(key, file.payload));
  } catch {
    throw new BackupError('invalid');
  }
  return { data: sanitizeData(raw), key };
}

// ---------------------------------------------------------------------------
// Validation. A backup is user-supplied input: every field is checked and
// anything unexpected is dropped rather than written to the database.

const str = (v: unknown, max: number): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;

const num = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined;

function sanitizeCycle(v: unknown): Cycle | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const c = v as Record<string, unknown>;
  const every = num(c.every, 1, 3650);
  if (!every || !['day', 'week', 'month', 'year'].includes(c.unit as string)) return undefined;
  return { every: Math.floor(every), unit: c.unit as Cycle['unit'] };
}

function sanitizeColor(v: unknown, fallback: string): string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
}

/** Only http(s) links are kept, so an imported file cannot smuggle in a `javascript:` URL. */
export function safeUrl(v: unknown): string | undefined {
  const s = str(v, 2000);
  if (!s) return undefined;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

function sanitizeSub(v: unknown): Subscription | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  const id = str(r.id, 64);
  const name = str(r.name, 120);
  const cycle = sanitizeCycle(r.cycle);
  const price = num(r.price, 0, 1e12);
  if (!id || !name || !cycle || price === undefined || !isValidISO(r.nextDate)) return null;
  const currency = isCurrency(r.currency) ? r.currency : 'USD';
  const now = new Date().toISOString();
  const payments: Payment[] = (Array.isArray(r.payments) ? r.payments : [])
    .filter((p): p is Payment => !!p && isValidISO(p.date) && num(p.amount, 0, 1e12) !== undefined && isCurrency(p.currency))
    .slice(-120)
    .map((p) => ({ date: p.date, amount: p.amount, currency: p.currency }));
  const priceHistory: PricePoint[] = (Array.isArray(r.priceHistory) ? r.priceHistory : [])
    .filter((p): p is PricePoint => !!p && isValidISO(p.date) && num(p.price, 0, 1e12) !== undefined && isCurrency(p.currency))
    .slice(-60)
    .map((p) => ({ date: p.date, price: p.price, currency: p.currency }));
  const remindDays = Array.isArray(r.remindDays)
    ? [...new Set(r.remindDays.filter((d): d is number => num(d, 0, 365) !== undefined).map(Math.floor))].slice(0, 6)
    : null;
  return {
    id,
    name,
    service: str(r.service, 40),
    color: sanitizeColor(r.color, '#7C7466'),
    categoryId: str(r.categoryId, 64) ?? FALLBACK_CATEGORY,
    price,
    currency,
    cycle,
    nextDate: r.nextDate,
    billingDay: num(r.billingDay, 1, 31),
    autoRenew: r.autoRenew !== false,
    status: ['active', 'trial', 'paused', 'cancelled'].includes(r.status as string) ? (r.status as Subscription['status']) : 'active',
    share: Math.floor(num(r.share, 1, 100) ?? 1),
    paymentMethod: str(r.paymentMethod, 80),
    url: safeUrl(r.url),
    notes: str(r.notes, 4000),
    remindDays: remindDays && remindDays.length ? remindDays : null,
    credentials: isCipher(r.credentials) ? { iv: r.credentials.iv, ct: r.credentials.ct } : null,
    priceHistory,
    payments,
    createdAt: str(r.createdAt, 40) ?? now,
    updatedAt: str(r.updatedAt, 40) ?? now,
  };
}

function sanitizeCategory(v: unknown, index: number): Category | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  const id = str(r.id, 64);
  if (!id) return null;
  return {
    id,
    name: str(r.name, 40),
    builtin: str(r.builtin, 40),
    color: sanitizeColor(r.color, '#7C7466'),
    emoji: str(r.emoji, 8) ?? '🗂️',
    order: num(r.order, 0, 10_000) ?? index,
  };
}

/** Settings that make sense on another device. */
function portableSettings(s: Partial<Settings>): Partial<Settings> {
  const { onboarded: _o, backup, ...rest } = s;
  return { ...rest, backup: backup ? { ...backup, lastAt: null } : undefined };
}

function sanitizeSettings(v: unknown): Partial<Settings> {
  if (!v || typeof v !== 'object') return {};
  const r = v as Record<string, unknown>;
  const out: Partial<Settings> = {};
  const pick = <K extends keyof Settings>(key: K, ok: (x: unknown) => boolean) => {
    if (ok(r[key])) out[key] = r[key] as Settings[K];
  };
  const oneOf = (list: readonly unknown[]) => (x: unknown) => list.includes(x);
  const bool = (x: unknown) => typeof x === 'boolean';
  pick('lang', oneOf(['ru', 'en', 'zh']));
  pick('appName', (x) => x === null || (typeof x === 'string' && x.length <= 40));
  pick('currency', isCurrency);
  pick('ratesAuto', bool);
  pick('dateFormat', oneOf(['auto', 'dmy', 'mdy', 'ymd']));
  pick('weekStart', oneOf([0, 1, 6]));
  pick('notifications', bool);
  pick('notifyTime', (x) => typeof x === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(x));
  pick('theme', oneOf(['system', 'light', 'dark']));
  pick('accent', oneOf(['vermilion', 'cobalt', 'emerald', 'violet', 'amber', 'rose', 'ink']));
  pick('density', oneOf(['cozy', 'compact']));
  pick('hideAmounts', bool);
  pick('sort', oneOf(['date', 'price', 'name']));
  pick('horizonDays', (x) => num(x, 1, 365) !== undefined);
  pick('lockOnLaunch', bool);
  pick('autoLockMin', (x) => num(x, 0, 1440) !== undefined);
  if (Array.isArray(r.remindDays)) {
    out.remindDays = [...new Set(r.remindDays.filter((d): d is number => num(d, 0, 365) !== undefined).map(Math.floor))].slice(0, 6);
  }
  if (r.rates && typeof r.rates === 'object') {
    out.rates = Object.fromEntries(
      Object.entries(r.rates as Record<string, unknown>).filter(
        (e): e is [string, number] => isCurrency(e[0]) && num(e[1], 1e-9, 1e9) !== undefined,
      ),
    );
  }
  if (r.backup && typeof r.backup === 'object') {
    const b = r.backup as Record<string, unknown>;
    out.backup = {
      intervalDays: Math.floor(num(b.intervalDays, 0, 365) ?? 3),
      encrypt: b.encrypt === true,
      keep: Math.floor(num(b.keep, 1, 50) ?? 5),
      lastAt: null,
    };
  }
  return out;
}

export function sanitizeData(v: unknown): BackupData {
  if (!v || typeof v !== 'object') throw new BackupError('invalid');
  const r = v as Record<string, unknown>;
  if (!Array.isArray(r.subscriptions)) throw new BackupError('invalid');
  const seen = new Set<string>();
  const subscriptions: Subscription[] = [];
  for (const item of r.subscriptions.slice(0, 5000)) {
    const sub = sanitizeSub(item);
    if (sub && !seen.has(sub.id)) {
      seen.add(sub.id);
      subscriptions.push(sub);
    }
  }
  const categories = (Array.isArray(r.categories) ? r.categories : [])
    .slice(0, 200)
    .map(sanitizeCategory)
    .filter((c): c is Category => !!c);
  const vault = isVaultMeta(r.vault) ? r.vault : null;
  if (!vault) for (const s of subscriptions) s.credentials = null;
  return { subscriptions, categories, settings: sanitizeSettings(r.settings), vault };
}

// ---------------------------------------------------------------------------

export interface ImportResult {
  added: number;
  updated: number;
  skipped: number;
  /** Stored passwords that could not be carried over. */
  credentialsDropped: number;
  vaultChanged: boolean;
}

export interface ImportOptions {
  mode: 'merge' | 'replace';
  /** Re-encrypts a credential from the backup's vault to the local one. */
  reencrypt?: (c: Cipher) => Promise<Cipher>;
}

const norm = (s: string) => s.trim().toLowerCase();

function looksSame(a: Subscription, b: Subscription): boolean {
  return norm(a.name) === norm(b.name) && a.price === b.price && a.currency === b.currency && sameCycle(a.cycle, b.cycle);
}

/** How the backup's vault relates to the one on this device. */
export async function vaultRelation(data: BackupData): Promise<'none' | 'adopt' | 'same' | 'different'> {
  if (!data.vault || !data.subscriptions.some((s) => s.credentials)) return 'none';
  const local = (await kvGet<VaultMeta>('vault')) ?? null;
  if (!local) return 'adopt';
  return sameVault(local, data.vault) ? 'same' : 'different';
}

export async function applyBackup(data: BackupData, opts: ImportOptions): Promise<ImportResult> {
  const result: ImportResult = { added: 0, updated: 0, skipped: 0, credentialsDropped: 0, vaultChanged: false };
  const localVault = (await kvGet<VaultMeta>('vault')) ?? null;
  const categories = ensureFallback(data.categories.length ? data.categories : DEFAULT_CATEGORIES);

  if (opts.mode === 'replace') {
    await db.transaction('rw', db.subs, db.categories, db.kv, async () => {
      await db.subs.clear();
      await db.categories.clear();
      await db.categories.bulkPut(categories);
      await db.subs.bulkPut(data.subscriptions);
      if (data.vault && !sameVault(localVault, data.vault)) {
        await kvSet('vault', data.vault);
        result.vaultChanged = true;
      }
    });
    result.added = data.subscriptions.length;
    await patchSettings({ ...data.settings, onboarded: true });
    return result;
  }

  // Merge: bring the incoming passwords under the local vault first.
  const relation = await vaultRelation(data);
  const incoming: Subscription[] = [];
  for (const sub of data.subscriptions) {
    let credentials = sub.credentials ?? null;
    if (credentials && relation === 'different') {
      try {
        credentials = opts.reencrypt ? await opts.reencrypt(credentials) : null;
      } catch {
        credentials = null;
      }
      if (!credentials) result.credentialsDropped++;
    }
    incoming.push({ ...sub, credentials });
  }

  await db.transaction('rw', db.subs, db.categories, db.kv, async () => {
    if (relation === 'adopt' && data.vault) {
      await kvSet('vault', data.vault);
      result.vaultChanged = true;
    }
    const knownCategories = new Set((await db.categories.toArray()).map((c) => c.id));
    let order = knownCategories.size;
    for (const c of categories) {
      if (!knownCategories.has(c.id)) await db.categories.put({ ...c, order: order++ });
    }
    const existing = await db.subs.toArray();
    const byId = new Map(existing.map((s) => [s.id, s]));
    for (const sub of incoming) {
      const mine = byId.get(sub.id);
      if (mine) {
        if (sub.updatedAt > mine.updatedAt) {
          await db.subs.put(sub);
          result.updated++;
        } else result.skipped++;
      } else if (existing.some((e) => looksSame(e, sub))) {
        result.skipped++;
      } else {
        await db.subs.put(sub);
        result.added++;
      }
    }
  });
  return result;
}

function ensureFallback(list: Category[]): Category[] {
  if (list.some((c) => c.id === FALLBACK_CATEGORY)) return list;
  const other = DEFAULT_CATEGORIES.find((c) => c.id === FALLBACK_CATEGORY)!;
  return [...list, { ...other, order: list.length }];
}

export function backupFileName(now = new Date(), encrypted = false): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
  return `subscriptions-backup-${stamp}${encrypted ? '.encrypted' : ''}.json`;
}

