import { CURRENCIES } from './money';
import { loadSettings, patchSettings } from './settings';

// The only network request the app ever makes, and only when the user allows it.
// It asks for a public table of exchange rates; nothing about the user is sent.
const SOURCES = [
  (base: string) => `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base}.json`,
  (base: string) => `https://latest.currency-api.pages.dev/v1/currencies/${base}.json`,
];

const STALE_MS = 20 * 3_600_000;

export async function fetchRates(base: string): Promise<Record<string, number>> {
  const code = base.toLowerCase();
  let lastError: unknown;
  for (const source of SOURCES) {
    try {
      const res = await fetch(source(code), { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const table = (await res.json())?.[code] as Record<string, unknown> | undefined;
      if (!table) throw new Error('empty');
      const rates: Record<string, number> = {};
      for (const cur of CURRENCIES) {
        const perBase = table[cur.toLowerCase()];
        if (cur !== base && typeof perBase === 'number' && perBase > 0) rates[cur] = Number((1 / perBase).toPrecision(6));
      }
      if (Object.keys(rates).length) return rates;
      throw new Error('empty');
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError ?? new Error('rates');
}

/** Returns true when the table was refreshed. */
export async function refreshRates(force = false): Promise<boolean> {
  const s = await loadSettings();
  if (!force) {
    if (!s.ratesAuto) return false;
    if (s.ratesUpdatedAt && Date.now() - Date.parse(s.ratesUpdatedAt) < STALE_MS) return false;
  }
  const fresh = await fetchRates(s.currency);
  const current = await loadSettings();
  if (current.currency !== s.currency) return false;
  await patchSettings({ rates: { ...current.rates, ...fresh }, ratesUpdatedAt: new Date().toISOString() });
  return true;
}
