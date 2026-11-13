import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { backupDue } from '../src/lib/autobackup';
import { defaultSettings } from '../src/lib/settings';
import { cycleProgress, markPaid, monthlyCost, occurrences, rollForward, urgency } from '../src/lib/schedule';
import { monthFlow, totals } from '../src/lib/stats';
import type { Subscription } from '../src/lib/types';

const sub = (patch: Partial<Subscription> = {}): Subscription => ({
  id: 'a',
  name: 'Test',
  color: '#000000',
  categoryId: 'other',
  price: 300,
  currency: 'RUB',
  cycle: { every: 1, unit: 'month' },
  nextDate: '2026-11-20',
  billingDay: 20,
  autoRenew: true,
  status: 'active',
  share: 1,
  priceHistory: [],
  payments: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...patch,
});

describe('schedule', () => {
  it('rolls an auto-renewing subscription past missed dates and logs the charges', () => {
    const r = rollForward(sub({ nextDate: '2026-09-20' }), '2026-11-13')!;
    expect(r.nextDate).toBe('2026-11-20');
    expect(r.payments.map((p) => p.date)).toEqual(['2026-09-20', '2026-10-20']);
  });

  it('keeps the charge day itself as "today"', () => {
    expect(rollForward(sub({ nextDate: '2026-11-13' }), '2026-11-13')).toBeNull();
  });

  it('leaves manual and paused subscriptions alone', () => {
    expect(rollForward(sub({ nextDate: '2026-09-20', autoRenew: false }), '2026-11-13')).toBeNull();
    expect(rollForward(sub({ nextDate: '2026-09-20', status: 'paused' }), '2026-11-13')).toBeNull();
  });

  it('turns a finished trial into an active subscription', () => {
    expect(rollForward(sub({ nextDate: '2026-11-01', status: 'trial' }), '2026-11-13')!.status).toBe('active');
  });

  it('renews a lapsed manual subscription from the day it is paid', () => {
    const r = markPaid(sub({ nextDate: '2026-10-01', autoRenew: false }), '2026-11-13');
    expect(r.nextDate).toBe('2026-12-13');
  });

  it('extends an early payment from the due date', () => {
    expect(markPaid(sub(), '2026-11-13').nextDate).toBe('2026-12-20');
  });

  it('projects future charges', () => {
    expect(occurrences(sub({ cycle: { every: 1, unit: 'week' }, nextDate: '2026-11-14' }), '2026-11-13', '2026-11-30')).toEqual([
      '2026-11-14',
      '2026-11-21',
      '2026-11-28',
    ]);
  });

  it('normalises costs to a month and counts only the own share', () => {
    expect(monthlyCost(sub({ price: 1200, cycle: { every: 1, unit: 'year' } }))).toBe(100);
    expect(monthlyCost(sub({ price: 600, share: 3 }))).toBe(200);
  });

  it('reports progress through the period', () => {
    expect(cycleProgress(sub({ nextDate: '2026-12-01', billingDay: 1 }), '2026-11-16')).toBeCloseTo(0.5, 1);
  });

  it('flags urgency', () => {
    expect(urgency(sub({ nextDate: '2026-11-12' }), '2026-11-13', 3)).toBe('overdue');
    expect(urgency(sub({ nextDate: '2026-11-13' }), '2026-11-13', 3)).toBe('today');
    expect(urgency(sub({ nextDate: '2026-11-15' }), '2026-11-13', 3)).toBe('soon');
    expect(urgency(sub({ nextDate: '2026-11-30' }), '2026-11-13', 3)).toBe('normal');
  });
});

describe('stats', () => {
  const money = { currency: 'RUB', rates: { USD: 90 } };

  it('converts currencies and lists the ones without a rate', () => {
    const t = totals([sub(), sub({ id: 'b', price: 10, currency: 'USD' }), sub({ id: 'c', price: 5, currency: 'EUR' })], money);
    expect(t.monthly).toBe(1200);
    expect(t.missing).toEqual(['EUR']);
  });

  it('splits the month into paid and upcoming', () => {
    const f = monthFlow([sub({ payments: [{ date: '2026-11-02', amount: 100, currency: 'RUB' }] })], money, '2026-11-13');
    expect(f.paid).toBe(100);
    expect(f.upcoming).toBe(300);
  });
});

describe('backup reminders', () => {
  const base = { ...defaultSettings('en'), backup: { intervalDays: 3, encrypt: false, lastAt: null as string | null, keep: 5 } };
  const now = Date.parse('2026-11-13T12:00:00Z');
  const created = (daysAgo: number) => [{ createdAt: new Date(now - daysAgo * 86_400_000).toISOString() }];

  it('does not nag on the day the first subscription is added', () => {
    expect(backupDue(base, created(0), now)).toBe(false);
    expect(backupDue(base, created(3), now)).toBe(true);
  });

  it('follows the chosen interval and can be switched off', () => {
    const recent = { ...base, backup: { ...base.backup, lastAt: new Date(now - 2 * 86_400_000).toISOString() } };
    const old = { ...base, backup: { ...base.backup, lastAt: new Date(now - 3 * 86_400_000).toISOString() } };
    expect(backupDue(recent, created(30), now)).toBe(false);
    expect(backupDue(old, created(30), now)).toBe(true);
    expect(backupDue({ ...old, backup: { ...old.backup, intervalDays: 0 } }, created(30), now)).toBe(false);
    expect(backupDue(old, [], now)).toBe(false);
  });
});
