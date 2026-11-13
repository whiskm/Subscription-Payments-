import { describe, expect, it } from 'vitest';
import { parseAmount, rebaseRates, toBase } from '../src/lib/money';
import { toCSV, toICS } from '../src/lib/exporters';
import type { Subscription } from '../src/lib/types';

describe('money', () => {
  it('parses amounts typed in different locales', () => {
    expect(parseAmount('299')).toBe(299);
    expect(parseAmount('9,99')).toBe(9.99);
    expect(parseAmount('1 299,90')).toBe(1299.9);
    expect(parseAmount('1,299.90')).toBe(1299.9);
    expect(parseAmount('1,299')).toBe(1299);
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });

  it('re-expresses rates for a new base currency', () => {
    const rates = rebaseRates({ USD: 90, EUR: 100 }, 'RUB', 'USD');
    expect(rates.RUB).toBeCloseTo(1 / 90);
    expect(rates.EUR).toBeCloseTo(100 / 90);
    expect(toBase(10, 'EUR', 'USD', rates)).toBeCloseTo(11.11, 2);
  });
});

describe('exporters', () => {
  const s: Subscription = {
    id: 'x1',
    name: '=HYPERLINK("evil")',
    color: '#000000',
    categoryId: 'other',
    price: 5,
    currency: 'USD',
    cycle: { every: 1, unit: 'month' },
    nextDate: '2026-01-31',
    billingDay: 31,
    autoRenew: true,
    status: 'active',
    share: 1,
    priceHistory: [],
    payments: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    credentials: { iv: 'aa', ct: 'secret' },
  };

  it('defuses spreadsheet formulas and never writes credentials', () => {
    const csv = toCSV([s], [], { headers: ['n'], category: () => '', cycle: () => 'm', status: () => 'a' });
    expect(csv).toContain(`"'=HYPERLINK(""evil"")"`);
    expect(csv).not.toContain('secret');
  });

  it('keeps month-end subscriptions on the last day of short months', () => {
    const ics = toICS([s], { remindDays: [1], notifyTime: '10:00' }, { calendarName: 'x', summary: (x) => x.name, description: () => '' });
    expect(ics).toContain('RRULE:FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=28,29,30,31;BYSETPOS=-1');
    expect(ics).toContain('TRIGGER:-PT840M');
    expect(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });
});
