import { db, kvGet, kvSet } from './db';
import { DEFAULT_CATEGORIES } from './categories';
import { rebaseRates } from './money';
import type { Lang, Settings } from './types';

export function detectLang(): Lang {
  const langs = typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]);
  for (const l of langs) {
    const code = l.toLowerCase();
    if (code.startsWith('ru') || code.startsWith('be') || code.startsWith('uk') || code.startsWith('kk')) return 'ru';
    if (code.startsWith('zh')) return 'zh';
    if (code.startsWith('en')) return 'en';
  }
  return 'en';
}

export const LANG_CURRENCY: Record<Lang, string> = { ru: 'RUB', en: 'USD', zh: 'CNY' };

export function defaultSettings(lang: Lang = detectLang()): Settings {
  return {
    onboarded: false,
    lang,
    appName: null,
    currency: LANG_CURRENCY[lang],
    rates: {},
    ratesAuto: true,
    ratesUpdatedAt: null,
    dateFormat: 'auto',
    weekStart: lang === 'en' ? 0 : 1,
    notifications: false,
    remindDays: [3, 1, 0],
    notifyTime: '10:00',
    theme: 'system',
    accent: 'vermilion',
    density: 'cozy',
    hideAmounts: false,
    sort: 'date',
    horizonDays: 14,
    backup: { intervalDays: 3, encrypt: false, lastAt: null, keep: 5 },
    lockOnLaunch: false,
    autoLockMin: 5,
    trayOnClose: true,
  };
}

/** Fills in anything missing, so settings saved by an older version keep working. */
export function mergeSettings(stored: Partial<Settings> | undefined, lang?: Lang): Settings {
  const base = defaultSettings(stored?.lang ?? lang);
  if (!stored) return base;
  return { ...base, ...stored, backup: { ...base.backup, ...stored.backup } };
}

export async function loadSettings(): Promise<Settings> {
  return mergeSettings(await kvGet<Partial<Settings>>('settings'));
}

export async function patchSettings(patch: Partial<Settings>): Promise<void> {
  await db.transaction('rw', db.kv, async () => {
    const current = await loadSettings();
    const next: Settings = { ...current, ...patch, backup: { ...current.backup, ...patch.backup } };
    if (patch.currency && patch.currency !== current.currency && !patch.rates) {
      next.rates = rebaseRates(current.rates, current.currency, patch.currency);
    }
    await kvSet('settings', next);
  });
  mirrorAppearance({ ...(await loadSettings()) });
}

export async function ensureDefaults(): Promise<void> {
  if ((await db.categories.count()) === 0) await db.categories.bulkPut(DEFAULT_CATEGORIES);
}

const MIRROR_KEY = 'sp:appearance';

/** A tiny synchronous copy of the look, so the first paint already has the right theme. */
export function mirrorAppearance(s: Pick<Settings, 'theme' | 'accent' | 'density' | 'lang'>): void {
  try {
    localStorage.setItem(MIRROR_KEY, JSON.stringify({ theme: s.theme, accent: s.accent, density: s.density, lang: s.lang }));
  } catch {
    /* private mode */
  }
}

export function readMirror(): Partial<Pick<Settings, 'theme' | 'accent' | 'density' | 'lang'>> {
  try {
    return JSON.parse(localStorage.getItem(MIRROR_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function applyAppearance(s: Partial<Pick<Settings, 'theme' | 'accent' | 'density' | 'lang'>>): void {
  const root = document.documentElement;
  if (s.theme) root.dataset.theme = s.theme;
  if (s.accent) root.dataset.accent = s.accent;
  if (s.density) root.dataset.density = s.density;
  if (s.lang) root.lang = s.lang === 'zh' ? 'zh-CN' : s.lang;
  if (s.theme) {
    const dark = s.theme === 'dark' || (s.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#121110' : '#EBE3D3');
  }
}
