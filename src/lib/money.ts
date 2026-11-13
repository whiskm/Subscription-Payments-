import type { Lang } from './types';

export const CURRENCIES = [
  'USD', 'EUR', 'RUB', 'CNY', 'GBP', 'JPY', 'KZT', 'BYN', 'UAH', 'TRY', 'GEL', 'AMD', 'UZS', 'AED',
  'HKD', 'TWD', 'KRW', 'SGD', 'INR', 'THB', 'VND', 'IDR', 'CHF', 'PLN', 'CZK', 'SEK', 'NOK', 'CAD',
  'AUD', 'BRL', 'MXN', 'ILS', 'RSD',
] as const;

export const LOCALE: Record<Lang, string> = { ru: 'ru-RU', en: 'en-US', zh: 'zh-CN' };

export function isCurrency(code: unknown): code is string {
  return typeof code === 'string' && /^[A-Z]{3}$/.test(code);
}

/** Converts to the base currency. Returns null when no rate is known. */
export function toBase(amount: number, currency: string, base: string, rates: Record<string, number>): number | null {
  if (currency === base) return amount;
  const rate = rates[currency];
  return rate && rate > 0 ? amount * rate : null;
}

/** Re-expresses the rate table after the base currency changes. */
export function rebaseRates(rates: Record<string, number>, oldBase: string, newBase: string): Record<string, number> {
  if (oldBase === newBase) return rates;
  const pivot = rates[newBase];
  if (!pivot || pivot <= 0) return {};
  const out: Record<string, number> = { [oldBase]: 1 / pivot };
  for (const [code, rate] of Object.entries(rates)) {
    if (code !== newBase && rate > 0) out[code] = rate / pivot;
  }
  return out;
}

const formatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(amount: number, currency: string, lang: Lang, opts: { hide?: boolean; round?: boolean } = {}): string {
  const whole = opts.round ?? (Math.abs(amount) >= 1000 || Number.isInteger(Math.round(amount * 100) / 100));
  const key = `${lang}|${currency}|${whole ? 0 : 2}`;
  let fmt = formatters.get(key);
  if (!fmt) {
    try {
      fmt = new Intl.NumberFormat(LOCALE[lang], {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: whole ? 0 : 2,
        maximumFractionDigits: whole ? 0 : 2,
      });
    } catch {
      fmt = new Intl.NumberFormat(LOCALE[lang], { maximumFractionDigits: whole ? 0 : 2 });
    }
    formatters.set(key, fmt);
  }
  if (opts.hide) {
    // Keep the currency symbol so the layout does not jump, mask only the digits.
    return fmt
      .formatToParts(0)
      .map((p) => (p.type === 'integer' ? '•••' : p.type === 'fraction' || p.type === 'decimal' ? '' : p.value))
      .join('');
  }
  return fmt.format(amount);
}

export function currencySymbol(currency: string, lang: Lang): string {
  try {
    const part = new Intl.NumberFormat(LOCALE[lang], { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0)
      .find((p) => p.type === 'currency');
    return part?.value ?? currency;
  } catch {
    return currency;
  }
}

/** Parses user input such as "1 299,90" or "1,299.90". */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[\s  ']/g, '');
  if (!cleaned) return null;
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let normalized = cleaned;
  if (lastComma > -1 && lastDot > -1) {
    const decimal = lastComma > lastDot ? ',' : '.';
    const group = decimal === ',' ? '.' : ',';
    normalized = cleaned.split(group).join('').replace(decimal, '.');
  } else if (lastComma > -1) {
    // "1,299" is a thousands separator, "9,99" a decimal comma.
    const grouped = /^\d{1,3}(,\d{3})+$/.test(cleaned);
    normalized = grouped ? cleaned.split(',').join('') : cleaned.replace(',', '.');
  }
  if (!/^\d*\.?\d*$/.test(normalized) || normalized === '.') return null;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
