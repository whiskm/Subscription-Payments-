import { backupFileName, collectBackup, serializeEncrypted, serializePlain } from './backup';
import { DAY_MS } from './dates';
import { kvGet, kvSet, db } from './db';
import { saveFile, type SaveOutcome } from './files';
import { desktopWriteBackup } from './desktop';
import { canLinkFile, isApp, isDesktopApp } from './platform';
import { loadSettings, patchSettings } from './settings';
import type { Settings, VaultMeta } from './types';

const HANDLE_KEY = 'backupHandle';
const NATIVE_DIR = 'SubscriptionPayments';

// The File System Access API is not in the default DOM typings yet.
interface LinkedHandle {
  name: string;
  queryPermission(d: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(d: { mode: 'readwrite' }): Promise<PermissionState>;
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
}

export function backupDue(s: Settings, subs: Array<{ createdAt: string }>, now = Date.now()): boolean {
  const { intervalDays, lastAt } = s.backup;
  if (!intervalDays || !subs.length) return false;
  // An hour of slack, so "every day" does not creep later and later.
  const interval = intervalDays * DAY_MS - 3_600_000;
  if (lastAt) return now - Date.parse(lastAt) >= interval;
  // Never backed up: count from the first subscription, not from day zero.
  const first = Math.min(...subs.map((x) => Date.parse(x.createdAt) || now));
  return now - first >= interval;
}

export type BackupBlocked = 'needs-unlock';

interface Built {
  text: string;
  name: string;
}

/** Builds the file, honouring the "encrypt the whole file" setting. */
async function build(key: CryptoKey | null): Promise<Built | BackupBlocked> {
  const [data, settings, vault] = await Promise.all([collectBackup(), loadSettings(), kvGet<VaultMeta>('vault')]);
  if (settings.backup.encrypt && vault) {
    if (!key) return 'needs-unlock';
    return { text: await serializeEncrypted(data, vault, key), name: backupFileName(new Date(), true) };
  }
  return { text: serializePlain(data), name: backupFileName() };
}

async function markDone(): Promise<void> {
  const s = await loadSettings();
  await patchSettings({ backup: { ...s.backup, lastAt: new Date().toISOString() } });
}

export async function linkedFileName(): Promise<string | null> {
  if (!canLinkFile) return null;
  return (await kvGet<LinkedHandle>(HANDLE_KEY))?.name ?? null;
}

/** Desktop Chromium: choose one file that later backups overwrite in place. */
export async function linkFile(): Promise<string | null> {
  // Must be called on window itself: a detached reference throws "Illegal invocation".
  const host = window as unknown as { showSaveFilePicker(o: object): Promise<LinkedHandle> };
  try {
    const handle = await host.showSaveFilePicker({
      suggestedName: 'subscriptions-backup.json',
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
    });
    await kvSet(HANDLE_KEY, handle);
    return handle.name;
  } catch {
    return null;
  }
}

export async function unlinkFile(): Promise<void> {
  await db.kv.delete(HANDLE_KEY);
}

async function writeLinked(text: string, ask: boolean): Promise<boolean> {
  if (!canLinkFile) return false;
  const handle = await kvGet<LinkedHandle>(HANDLE_KEY);
  if (!handle) return false;
  try {
    let state = await handle.queryPermission({ mode: 'readwrite' });
    if (state !== 'granted' && ask) state = await handle.requestPermission({ mode: 'readwrite' });
    if (state !== 'granted') return false;
    const w = await handle.createWritable();
    await w.write(text);
    await w.close();
    return true;
  } catch {
    return false;
  }
}

async function writeNative(built: Built, keep: number): Promise<boolean> {
  if (isDesktopApp) {
    try {
      await desktopWriteBackup(built.name, built.text, keep);
      return true;
    } catch {
      return false;
    }
  }
  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const perm = await Filesystem.checkPermissions().catch(() => null);
    if (perm && perm.publicStorage !== 'granted') await Filesystem.requestPermissions().catch(() => null);
    await Filesystem.writeFile({
      path: `${NATIVE_DIR}/${built.name}`,
      data: built.text,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    // Keep only the newest copies; the names sort by date.
    const listing = await Filesystem.readdir({ path: NATIVE_DIR, directory: Directory.Documents }).catch(() => null);
    const old = (listing?.files ?? [])
      .map((f) => f.name)
      .filter((n) => n.startsWith('subscriptions-backup-'))
      .sort()
      .reverse()
      .slice(Math.max(1, keep));
    for (const name of old) {
      await Filesystem.deleteFile({ path: `${NATIVE_DIR}/${name}`, directory: Directory.Documents }).catch(() => null);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Tries to back up without bothering the user: on Android into Documents,
 * on desktop into the linked file. Returns false when a tap is needed.
 */
export async function silentBackup(key: CryptoKey | null): Promise<boolean> {
  // Nowhere to write without the user: skip the work of building the file.
  if (!isApp && !(canLinkFile && (await kvGet<LinkedHandle>(HANDLE_KEY)))) return false;
  const built = await build(key);
  if (built === 'needs-unlock') return false;
  const settings = await loadSettings();
  const ok = isApp ? await writeNative(built, settings.backup.keep) : await writeLinked(built.text, false);
  if (ok) await markDone();
  return ok;
}

export type ManualOutcome = SaveOutcome | 'linked' | 'saved' | BackupBlocked;

/** A backup started by the user; may show a share sheet or a permission prompt. */
export async function manualBackup(key: CryptoKey | null, opts: { forceShare?: boolean } = {}): Promise<ManualOutcome> {
  const built = await build(key);
  if (built === 'needs-unlock') return built;
  if (!opts.forceShare) {
    if (!isApp && (await writeLinked(built.text, true))) {
      await markDone();
      return 'linked';
    }
    if (isApp && (await writeNative(built, (await loadSettings()).backup.keep))) {
      await markDone();
      return 'saved';
    }
  }
  const outcome = await saveFile(built.name, built.text, 'application/json');
  if (outcome !== 'cancelled') await markDone();
  return outcome;
}
