import { addDays, parts, toLocalDate, weekday } from './dates';
import { LOCALE } from './money';
import type { DateFormat, ISODate, Lang } from './types';

const cache = new Map<string, Intl.DateTimeFormat>();

function dtf(lang: Lang, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = lang + JSON.stringify(options);
  let f = cache.get(key);
  if (!f) cache.set(key, (f = new Intl.DateTimeFormat(LOCALE[lang], options)));
  return f;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function formatDate(iso: ISODate, lang: Lang, format: DateFormat, opts: { year?: boolean } = {}): string {
  const { y, m, d } = parts(iso);
  const year = opts.year ?? y !== new Date().getFullYear();
  switch (format) {
    case 'dmy':
      return year ? `${pad(d)}.${pad(m)}.${y}` : `${pad(d)}.${pad(m)}`;
    case 'mdy':
      return year ? `${pad(m)}/${pad(d)}/${y}` : `${pad(m)}/${pad(d)}`;
    case 'ymd':
      return year ? iso : `${pad(m)}-${pad(d)}`;
    default:
      return dtf(lang, { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) })
        .format(toLocalDate(iso))
        .replace(/\s?г\.$/, '');
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "November 2026", "Ноябрь 2026", "2026年11月". */
export function monthTitle(iso: ISODate, lang: Lang): string {
  if (lang === 'zh') return dtf(lang, { year: 'numeric', month: 'long' }).format(toLocalDate(iso));
  const month = dtf(lang, { month: 'long' }).format(toLocalDate(iso));
  return `${cap(month)} ${parts(iso).y}`;
}

export function monthShort(iso: ISODate, lang: Lang): string {
  return dtf(lang, { month: 'short' }).format(toLocalDate(iso)).replace('.', '');
}

export function weekdayLong(iso: ISODate, lang: Lang): string {
  return dtf(lang, { weekday: 'long' }).format(toLocalDate(iso));
}

/** Short weekday names, starting from the configured first day of the week. */
export function weekdayNames(lang: Lang, weekStart: number): string[] {
  // 2023-01-01 was a Sunday.
  const sunday = '2023-01-01';
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(sunday, (weekStart + i) % 7);
    return dtf(lang, { weekday: 'short' }).format(toLocalDate(day));
  });
}

/** Column (0–6) of a date in a week that starts on `weekStart`. */
export function weekColumn(iso: ISODate, weekStart: number): number {
  return (weekday(iso) - weekStart + 7) % 7;
}
