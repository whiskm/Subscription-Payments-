import { addDays, addMonths, endOfMonth, startOfMonth } from './dates';
import { toBase } from './money';
import { daysLeft, isCounted, monthlyCost, occurrences, ownShare } from './schedule';
import type { ISODate, Settings, Subscription } from './types';

type Money = Pick<Settings, 'currency' | 'rates'>;

/** Sums amounts in the base currency and remembers currencies with no known rate. */
class Sum {
  total = 0;
  missing = new Set<string>();
  constructor(private m: Money) {}
  add(amount: number, currency: string): number {
    const v = toBase(amount, currency, this.m.currency, this.m.rates);
    if (v === null) {
      this.missing.add(currency);
      return 0;
    }
    this.total += v;
    return v;
  }
}

export interface Totals {
  monthly: number;
  yearly: number;
  count: number;
  missing: string[];
}

/** The steady monthly and yearly cost of everything that is currently running. */
export function totals(subs: Subscription[], m: Money): Totals {
  const sum = new Sum(m);
  let count = 0;
  for (const s of subs) {
    if (!isCounted(s)) continue;
    count++;
    sum.add(monthlyCost(s), s.currency);
  }
  return { monthly: sum.total, yearly: sum.total * 12, count, missing: [...sum.missing] };
}

export interface MonthFlow {
  paid: number;
  upcoming: number;
  total: number;
  missing: string[];
}

/** What this calendar month costs: charges already made plus those still to come. */
export function monthFlow(subs: Subscription[], m: Money, today: ISODate): MonthFlow {
  const from = startOfMonth(today);
  const to = endOfMonth(today);
  const paid = new Sum(m);
  const upcoming = new Sum(m);
  for (const s of subs) {
    for (const p of s.payments) if (p.date >= from && p.date <= to) paid.add(p.amount, p.currency);
    for (const _ of occurrences(s, today, to)) upcoming.add(ownShare(s), s.currency);
  }
  return {
    paid: paid.total,
    upcoming: upcoming.total,
    total: paid.total + upcoming.total,
    missing: [...new Set([...paid.missing, ...upcoming.missing])],
  };
}

export interface MonthBucket {
  month: ISODate;
  total: number;
  count: number;
}

/** Expected charges for this month and the following ones. */
export function forecast(subs: Subscription[], m: Money, today: ISODate, months = 12): MonthBucket[] {
  const first = startOfMonth(today);
  const buckets: MonthBucket[] = [];
  for (let i = 0; i < months; i++) {
    const month = addMonths(first, i);
    const from = i === 0 ? today : month;
    const sum = new Sum(m);
    let count = 0;
    for (const s of subs) {
      for (const _ of occurrences(s, from, endOfMonth(month))) {
        sum.add(ownShare(s), s.currency);
        count++;
      }
    }
    buckets.push({ month, total: sum.total, count });
  }
  return buckets;
}

export interface CategoryShare {
  categoryId: string;
  monthly: number;
  count: number;
}

export function byCategory(subs: Subscription[], m: Money): CategoryShare[] {
  const map = new Map<string, CategoryShare>();
  for (const s of subs) {
    if (!isCounted(s)) continue;
    const v = toBase(monthlyCost(s), s.currency, m.currency, m.rates) ?? 0;
    const row = map.get(s.categoryId) ?? { categoryId: s.categoryId, monthly: 0, count: 0 };
    row.monthly += v;
    row.count++;
    map.set(s.categoryId, row);
  }
  return [...map.values()].sort((a, b) => b.monthly - a.monthly);
}

export interface Upcoming {
  sub: Subscription;
  days: number;
}

/** Subscriptions that need attention within the horizon, most urgent first. */
export function upcoming(subs: Subscription[], today: ISODate, horizonDays: number): Upcoming[] {
  const limit = addDays(today, horizonDays);
  return subs
    .filter((s) => s.status !== 'paused' && s.nextDate <= limit && (isCounted(s) || s.nextDate >= today))
    .map((sub) => ({ sub, days: daysLeft(sub, today) }))
    .sort((a, b) => a.days - b.days || a.sub.name.localeCompare(b.sub.name));
}

export function sortSubs(subs: Subscription[], key: Settings['sort'], m: Money): Subscription[] {
  const rank = (s: Subscription) => (s.status === 'paused' ? 1 : s.status === 'cancelled' ? 2 : 0);
  const cost = (s: Subscription) => toBase(monthlyCost(s), s.currency, m.currency, m.rates) ?? 0;
  return [...subs].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (key === 'price') return cost(b) - cost(a);
    if (key === 'name') return a.name.localeCompare(b.name);
    return a.nextDate.localeCompare(b.nextDate) || a.name.localeCompare(b.name);
  });
}
