import { desktopCopy, desktopSaveFile } from './desktop';
import { isAndroidApp, isDesktopApp, isTouch } from './platform';

export type SaveOutcome = 'shared' | 'downloaded' | 'saved' | 'cancelled';

/**
 * Hands a generated file to the user. Phones get the system share sheet
 * ("Save to Files", send to yourself…), desktops get a regular download.
 */
export async function saveFile(name: string, content: string, mime: string): Promise<SaveOutcome> {
  if (isDesktopApp) return (await desktopSaveFile(name, content)) ? 'saved' : 'cancelled';
  if (isAndroidApp) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const written = await Filesystem.writeFile({ path: name, data: content, directory: Directory.Cache, encoding: Encoding.UTF8 });
    try {
      await Share.share({ title: name, files: [written.uri] });
      return 'shared';
    } catch {
      return 'cancelled';
    }
  }

  const file = new File([content], name, { type: mime });
  if (isTouch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
      // Fall through to a plain download when sharing is refused.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

export function pickTextFile(accept: string): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    input.onchange = async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file || file.size > 20 * 1024 * 1024) return resolve(null);
      resolve(await file.text());
    };
    input.addEventListener('cancel', () => {
      input.remove();
      resolve(null);
    });
    document.body.appendChild(input);
    input.click();
  });
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (isDesktopApp) await desktopCopy(text);
    else await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Best-effort wipe of a copied password. */
export async function clearClipboard(): Promise<void> {
  await copyText('');
}
