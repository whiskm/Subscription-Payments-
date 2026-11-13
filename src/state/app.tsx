import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { DEFAULT_APP_NAME, plural, translate, type Key, type Params, type PluralKey } from '../i18n';
import { db } from '../lib/db';
import { diffDays, todayISO } from '../lib/dates';
import { formatDate } from '../lib/format';
import { formatMoney } from '../lib/money';
import { applyAppearance, mergeSettings, patchSettings } from '../lib/settings';
import type { Category, Cycle, ISODate, Lang, Settings, Subscription } from '../lib/types';

export interface AppValue {
  settings: Settings;
  update: (patch: Partial<Settings>) => Promise<void>;
  subs: Subscription[];
  categories: Category[];
  today: ISODate;
  lang: Lang;
  appName: string;
  t: (key: Key, params?: Params) => string;
  tn: (key: PluralKey, n: number, params?: Params) => string;
  /** Formats money; respects the "hide amounts" setting. */
  money: (amount: number, currency?: string, opts?: { round?: boolean; show?: boolean }) => string;
  date: (iso: ISODate, opts?: { year?: boolean }) => string;
  category: (id: string) => Category;
  categoryName: (c: Category) => string;
  cycleLabel: (c: Cycle) => string;
  perLabel: (c: Cycle) => string;
  /** "in 5 days", "today", "3 days overdue". */
  dueLabel: (date: ISODate) => string;
}

const Ctx = createContext<AppValue | null>(null);

export function useApp(): AppValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppProvider is missing');
  return v;
}

function useToday(): ISODate {
  const [today, setToday] = useState(todayISO);
  useEffect(() => {
    const check = () => setToday((prev) => (prev === todayISO() ? prev : todayISO()));
    const timer = window.setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return today;
}

const UNKNOWN_CATEGORY: Category = { id: 'other', builtin: 'other', emoji: '🗂️', color: '#7C7466', order: 999 };

export function AppProvider({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const stored = useLiveQuery(async () => ({ value: (await db.kv.get('settings'))?.value as Partial<Settings> | undefined }), []);
  const subs = useLiveQuery(() => db.subs.toArray(), []);
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray(), []);
  const today = useToday();

  const settings = useMemo(() => (stored ? mergeSettings(stored.value) : null), [stored]);

  useEffect(() => {
    if (settings) applyAppearance(settings);
  }, [settings?.theme, settings?.accent, settings?.density, settings?.lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = useCallback((patch: Partial<Settings>) => patchSettings(patch), []);

  const value = useMemo<AppValue | null>(() => {
    if (!settings || !subs || !categories) return null;
    const lang = settings.lang;
    const t = (key: Key, params?: Params) => translate(lang, key, params);
    const tn = (key: PluralKey, n: number, params?: Params) => plural(lang, key, n, params);
    const byId = new Map(categories.map((c) => [c.id, c]));
    const unit = (c: Cycle, keys: Record<Cycle['unit'], PluralKey>) => tn(keys[c.unit], c.every);
    return {
      settings,
      update,
      subs,
      categories,
      today,
      lang,
      appName: settings.appName?.trim() || DEFAULT_APP_NAME[lang],
      t,
      tn,
      money: (amount, currency = settings.currency, opts = {}) =>
        formatMoney(amount, currency, lang, { hide: settings.hideAmounts && !opts.show, round: opts.round }),
      date: (iso, opts) => formatDate(iso, lang, settings.dateFormat, opts),
      category: (id) => byId.get(id) ?? byId.get('other') ?? UNKNOWN_CATEGORY,
      categoryName: (c) => c.name?.trim() || (c.builtin ? t(`cat.${c.builtin}` as Key) : c.id),
      cycleLabel: (c) => {
        if (c.every === 1) return t(`cycle.${c.unit}` as Key);
        if (c.unit === 'month' && c.every === 3) return t('cycle.quarter');
        if (c.unit === 'month' && c.every === 6) return t('cycle.halfYear');
        return unit(c, { day: 'everyDays', week: 'everyWeeks', month: 'everyMonths', year: 'everyYears' });
      },
      perLabel: (c) => (c.every === 1 ? `/ ${t(`per.${c.unit}` as Key)}` : `/ ${c.every} ${t(`per.${c.unit}` as Key)}`),
      dueLabel: (iso) => {
        const days = diffDays(today, iso);
        if (days === 0) return t('due.today');
        if (days === 1) return t('due.tomorrow');
        return days < 0 ? tn('daysOverdue', -days) : tn('inDays', days);
      },
    };
  }, [settings, subs, categories, today, update]);

  if (!value) return <>{fallback ?? null}</>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
