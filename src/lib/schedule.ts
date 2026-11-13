import { addCycle, diffDays, parts } from './dates';
import type { Cycle, ISODate, Payment, Subscription } from './types';

const MAX_PAYMENTS = 120;
const MAX_STEPS = 5000;

/** Subscriptions that cost money now or will shortly. */
export function isCounted(sub: Subscription): boolean {
  return sub.status === 'active' || sub.status === 'trial';
}

export function daysLeft(sub: Subscription, today: ISODate): number {
  return diffDays(today, sub.nextDate);
}

/** The user's own part of one charge. */
export function ownShare(sub: Subscription): number {
  return sub.price / Math.max(1, sub.share || 1);
}

function pushPayment(list: Payment[], p: Payment): Payment[] {
  const next = [...list, p];
  return next.length > MAX_PAYMENTS ? next.slice(next.length - MAX_PAYMENTS) : next;
}

/**
 * Auto-renewing subscriptions move on by themselves once the charge date has
 * passed. Returns the updated subscription, or null when nothing changed.
 * The charge day itself still shows as "today"; it rolls the day after.
 */
export function rollForward(sub: Subscription, today: ISODate): Subscription | null {
  if (!sub.autoRenew || !isCounted(sub) || sub.nextDate >= today) return null;
  let next = sub.nextDate;
  let payments = sub.payments;
  for (let i = 0; i < MAX_STEPS && next < today; i++) {
    payments = pushPayment(payments, { date: next, amount: ownShare(sub), currency: sub.currency });
    next = addCycle(next, sub.cycle, 1, sub.billingDay);
  }
  return { ...sub, nextDate: next, payments, status: 'active', updatedAt: new Date().toISOString() };
}

/**
 * The user confirms a payment. Paying early extends from the due date; paying
 * a lapsed manual subscription starts a fresh period from today.
 */
export function markPaid(sub: Subscription, today: ISODate): Subscription {
  const lapsed = sub.nextDate < today && !sub.autoRenew;
  const base = lapsed ? today : sub.nextDate;
  const billingDay = lapsed ? parts(today).d : sub.billingDay;
  return {
    ...sub,
    billingDay,
    nextDate: addCycle(base, sub.cycle, 1, billingDay),
    payments: pushPayment(sub.payments, { date: today, amount: ownShare(sub), currency: sub.currency }),
    status: 'active',
    updatedAt: new Date().toISOString(),
  };
}

/** Charge dates within [from, to], inclusive. */
export function occurrences(sub: Subscription, from: ISODate, to: ISODate): ISODate[] {
  if (!isCounted(sub)) return [];
  let d = sub.nextDate;
  if (d < from) {
    // A lapsed manual subscription has no known future date until it is renewed.
    if (!sub.autoRenew) return [];
    for (let i = 0; i < MAX_STEPS && d < from; i++) d = addCycle(d, sub.cycle, 1, sub.billingDay);
  }
  const out: ISODate[] = [];
  for (let i = 0; i < MAX_STEPS && d <= to; i++) {
    out.push(d);
    d = addCycle(d, sub.cycle, 1, sub.billingDay);
  }
  return out;
}

const DAYS_PER_MONTH = 365.25 / 12;

/** How many charges of this cycle fit in an average month. */
export function perMonthFactor(cycle: Cycle): number {
  const every = Math.max(1, cycle.every);
  switch (cycle.unit) {
    case 'day':
      return DAYS_PER_MONTH / every;
    case 'week':
      return DAYS_PER_MONTH / 7 / every;
    case 'month':
      return 1 / every;
    case 'year':
      return 1 / (12 * every);
  }
}

/** The user's monthly cost in the subscription's own currency. */
export function monthlyCost(sub: Subscription): number {
  return ownShare(sub) * perMonthFactor(sub.cycle);
}

/** Fraction of the current period that has already elapsed, 0…1. */
export function cycleProgress(sub: Subscription, today: ISODate): number {
  const start = addCycle(sub.nextDate, sub.cycle, -1, sub.billingDay);
  const total = diffDays(start, sub.nextDate);
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, diffDays(start, today) / total));
}

export type Urgency = 'overdue' | 'today' | 'soon' | 'normal' | 'idle';

export function urgency(sub: Subscription, today: ISODate, soonDays: number): Urgency {
  if (sub.status === 'paused') return 'idle';
  const left = daysLeft(sub, today);
  if (sub.status === 'cancelled') return left < 0 ? 'idle' : left <= soonDays ? 'soon' : 'normal';
  if (left < 0) return 'overdue';
  if (left === 0) return 'today';
  return left <= soonDays ? 'soon' : 'normal';
}

/** Reminder offsets that apply to this subscription. */
export function remindDaysFor(sub: Subscription, globalDays: number[]): number[] {
  return sub.remindDays && sub.remindDays.length ? sub.remindDays : globalDays;
}

export function sameCycle(a: Cycle, b: Cycle): boolean {
  return a.unit === b.unit && a.every === b.every;
}
