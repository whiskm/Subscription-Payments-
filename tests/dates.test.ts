import { describe, expect, it } from 'vitest';
import { addCycle, addMonths, diffDays, isValidISO } from '../src/lib/dates';

describe('dates', () => {
  it('clamps to the end of short months and restores the billing day', () => {
    expect(addMonths('2026-01-31', 1, 31)).toBe('2026-02-28');
    expect(addMonths('2026-02-28', 1, 31)).toBe('2026-03-31');
    expect(addMonths('2028-01-31', 1, 31)).toBe('2028-02-29');
  });

  it('moves yearly subscriptions from 29 February to the 28th', () => {
    expect(addCycle('2028-02-29', { every: 1, unit: 'year' }, 1, 29)).toBe('2029-02-28');
  });

  it('steps backwards for the start of the current period', () => {
    expect(addCycle('2026-03-15', { every: 1, unit: 'month' }, -1)).toBe('2026-02-15');
    expect(addCycle('2026-01-10', { every: 2, unit: 'week' }, -1)).toBe('2025-12-27');
  });

  it('counts days across daylight-saving changes', () => {
    expect(diffDays('2026-03-28', '2026-03-30')).toBe(2);
    expect(diffDays('2026-10-24', '2026-10-26')).toBe(2);
    expect(diffDays('2026-11-13', '2026-11-10')).toBe(-3);
  });

  it('validates calendar dates', () => {
    expect(isValidISO('2026-02-29')).toBe(false);
    expect(isValidISO('2028-02-29')).toBe(true);
    expect(isValidISO('2026-13-01')).toBe(false);
    expect(isValidISO('nope')).toBe(false);
  });
});
