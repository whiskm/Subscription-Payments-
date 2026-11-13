import { en, enPlurals, type Key, type PluralKey } from './en';
import { ru, ruPlurals } from './ru';
import { zh, zhPlurals } from './zh';
import type { Lang } from '../lib/types';

export type { Key, PluralKey };
export type Params = Record<string, string | number>;

const DICT: Record<Lang, Record<Key, string>> = { en, ru, zh };
const PLURALS: Record<Lang, Record<PluralKey, Partial<Record<Intl.LDMLPluralRule, string>>>> = {
  en: enPlurals,
  ru: ruPlurals,
  zh: zhPlurals,
};
const RULES: Record<Lang, Intl.PluralRules> = {
  en: new Intl.PluralRules('en'),
  ru: new Intl.PluralRules('ru'),
  zh: new Intl.PluralRules('zh'),
};

function fill(template: string, params?: Params): string {
  return params ? template.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : template;
}

export function translate(lang: Lang, key: Key, params?: Params): string {
  return fill(DICT[lang][key] ?? en[key] ?? key, params);
}

/** "1 day", "3 дня", "5 дней" — the count is substituted for {n}. */
export function plural(lang: Lang, key: PluralKey, n: number, params?: Params): string {
  const forms = PLURALS[lang][key];
  const form = forms[RULES[lang].select(Math.abs(n))] ?? forms.other ?? '';
  return fill(form, { n, ...params });
}

export const LANG_NAMES: Record<Lang, string> = { ru: 'Русский', en: 'English', zh: '简体中文' };
export const DEFAULT_APP_NAME: Record<Lang, string> = {
  ru: 'Оплата подписок',
  en: 'Subscription Payments',
  zh: '订阅付款',
};
