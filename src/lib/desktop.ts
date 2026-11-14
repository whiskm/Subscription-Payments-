// Bridge to the Windows / Linux shell (src-tauri). Every import is lazy, so
// the website and the Android app never load any of this.
import { isDesktopApp } from './platform';

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

/** Opens the system "Save as" dialog. Returns false when cancelled. */
export function desktopSaveFile(name: string, contents: string): Promise<boolean> {
  return invoke<boolean>('save_file', { name, contents });
}

/** Writes an automatic backup into Documents/SubscriptionPayments. */
export function desktopWriteBackup(name: string, contents: string, keep: number): Promise<string> {
  return invoke<string>('write_backup', { name, contents, keep });
}

export function openBackupFolder(): Promise<void> {
  return invoke<void>('open_backup_folder');
}

export async function setKeepInTray(enabled: boolean): Promise<void> {
  if (isDesktopApp) await invoke('set_keep_in_tray', { enabled }).catch(() => undefined);
}

export async function setTrayLabels(open: string, quit: string): Promise<void> {
  if (isDesktopApp) await invoke('set_tray_labels', { open, quit }).catch(() => undefined);
}

export async function setWindowTitle(title: string): Promise<void> {
  if (!isDesktopApp) return;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await getCurrentWindow().setTitle(title).catch(() => undefined);
}

export async function desktopNotify(title: string, body: string): Promise<void> {
  const { sendNotification } = await import('@tauri-apps/plugin-notification');
  sendNotification({ title, body });
}

export async function desktopNotifyPermission(ask: boolean): Promise<'granted' | 'denied' | 'prompt'> {
  const { isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification');
  if (await isPermissionGranted()) return 'granted';
  if (!ask) return 'prompt';
  const p = await requestPermission();
  return p === 'granted' ? 'granted' : p === 'denied' ? 'denied' : 'prompt';
}

export async function autostartEnabled(): Promise<boolean> {
  const { isEnabled } = await import('@tauri-apps/plugin-autostart');
  return isEnabled();
}

export async function setAutostart(on: boolean): Promise<void> {
  const { enable, disable } = await import('@tauri-apps/plugin-autostart');
  await (on ? enable() : disable());
}

export async function desktopCopy(text: string): Promise<void> {
  const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
  await writeText(text);
}

/** Links open in the default browser, not inside the app window. */
export async function openExternal(url: string): Promise<void> {
  if (!/^https?:\/\//i.test(url)) return;
  if (isDesktopApp) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/** Sends every click on an external link to the system browser. */
export function routeExternalLinks(): void {
  if (!isDesktopApp) return;
  document.addEventListener('click', (e) => {
    const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a || !/^https?:/i.test(a.href) || a.origin === window.location.origin) return;
    e.preventDefault();
    void openExternal(a.href);
  });
}
