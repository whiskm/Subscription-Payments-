import { db } from './db';
import { newId } from './crypto';
import { FALLBACK_CATEGORY } from './categories';
import { addCycle, parts, todayISO } from './dates';
import { markPaid, rollForward } from './schedule';
import type { ISODate, Settings, Subscription } from './types';

export function blankSubscription(settings: Pick<Settings, 'currency'>, today: ISODate = todayISO()): Subscription {
  const now = new Date().toISOString();
  const cycle = { every: 1, unit: 'month' } as const;
  const nextDate = addCycle(today, cycle);
  return {
    id: newId(),
    name: '',
    color: '#E4572E',
    categoryId: FALLBACK_CATEGORY,
    price: 0,
    currency: settings.currency,
    cycle,
    nextDate,
    billingDay: parts(nextDate).d,
    autoRenew: true,
    status: 'active',
    share: 1,
    remindDays: null,
    credentials: null,
    priceHistory: [],
    payments: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Saves a subscription and records a price change in its history. */
export async function saveSubscription(sub: Subscription, today: ISODate = todayISO()): Promise<void> {
  const previous = await db.subs.get(sub.id);
  let priceHistory = sub.priceHistory;
  if (previous && (previous.price !== sub.price || previous.currency !== sub.currency)) {
    if (!priceHistory.length) {
      priceHistory = [{ date: previous.createdAt.slice(0, 10), price: previous.price, currency: previous.currency }];
    }
    priceHistory = [...priceHistory, { date: today, price: sub.price, currency: sub.currency }].slice(-60);
  }
  await db.subs.put({ ...sub, priceHistory, updatedAt: new Date().toISOString() });
}

export async function deleteSubscription(id: string): Promise<void> {
  await db.subs.delete(id);
}

/** Moves every auto-renewing subscription past charge dates that have gone by. */
export async function rollAll(today: ISODate = todayISO()): Promise<number> {
  const due = await db.subs.where('nextDate').below(today).toArray();
  const changed = due.map((s) => rollForward(s, today)).filter((s): s is Subscription => !!s);
  if (changed.length) await db.subs.bulkPut(changed);
  return changed.length;
}

export async function payNow(id: string, today: ISODate = todayISO()): Promise<Subscription | undefined> {
  const sub = await db.subs.get(id);
  if (!sub) return undefined;
  const next = markPaid(sub, today);
  await db.subs.put(next);
  return next;
}

export async function setStatus(id: string, status: Subscription['status'], today: ISODate = todayISO()): Promise<void> {
  const sub = await db.subs.get(id);
  if (!sub) return;
  const resuming = sub.status === 'paused' && status !== 'paused';
  await db.subs.put({
    ...sub,
    status,
    // After a pause the old date is stale: treat the payment as due now rather
    // than silently logging charges for the months it was paused.
    nextDate: resuming && sub.nextDate < today ? today : sub.nextDate,
    updatedAt: new Date().toISOString(),
  });
}

export async function eraseEverything(): Promise<void> {
  await db.delete();
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
}
