import type { Cycle, ISODate } from './types';

// All date math runs on UTC midnights so daylight-saving shifts can never
// turn "one day later" into 23 or 25 hours.
export const DAY_MS = 86_400_000;

const pad = (n: number, len = 2) => String(n).padStart(len, '0');

export function isoFromParts(y: number, m: number, d: number): ISODate {
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
}

export function todayISO(now: Date = new Date()): ISODate {
  return isoFromParts(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function parts(iso: ISODate): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function isValidISO(s: unknown): s is ISODate {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const { y, m, d } = parts(s);
  return y >= 1970 && y <= 9999 && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function toUTC(iso: ISODate): number {
  const { y, m, d } = parts(iso);
  return Date.UTC(y, m - 1, d);
}

export function fromUTC(ms: number): ISODate {
  const dt = new Date(ms);
  return isoFromParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** A Date at local midnight, for Intl formatting. */
export function toLocalDate(iso: ISODate): Date {
  const { y, m, d } = parts(iso);
  return new Date(y, m - 1, d);
}

export function addDays(iso: ISODate, n: number): ISODate {
  return fromUTC(toUTC(iso) + n * DAY_MS);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function diffDays(from: ISODate, to: ISODate): number {
  return Math.round((toUTC(to) - toUTC(from)) / DAY_MS);
}

/**
 * Adds calendar months, clamping to the end of shorter months.
 * `billingDay` restores the intended day afterwards (31 Jan → 28 Feb → 31 Mar).
 */
export function addMonths(iso: ISODate, n: number, billingDay?: number): ISODate {
  const { y, m, d } = parts(iso);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return isoFromParts(ny, nm, Math.min(billingDay ?? d, daysInMonth(ny, nm)));
}

export function addCycle(iso: ISODate, cycle: Cycle, n = 1, billingDay?: number): ISODate {
  const steps = Math.max(1, Math.floor(cycle.every)) * n;
  switch (cycle.unit) {
    case 'day':
      return addDays(iso, steps);
    case 'week':
      return addDays(iso, steps * 7);
    case 'month':
      return addMonths(iso, steps, billingDay);
    case 'year':
      return addMonths(iso, steps * 12, billingDay);
  }
}

export function startOfMonth(iso: ISODate): ISODate {
  const { y, m } = parts(iso);
  return isoFromParts(y, m, 1);
}

export function endOfMonth(iso: ISODate): ISODate {
  const { y, m } = parts(iso);
  return isoFromParts(y, m, daysInMonth(y, m));
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(iso: ISODate): number {
  return new Date(toUTC(iso)).getUTCDay();
}
