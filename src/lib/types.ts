export type Lang = 'ru' | 'en' | 'zh';
export type CycleUnit = 'day' | 'week' | 'month' | 'year';
export type SubStatus = 'active' | 'trial' | 'paused' | 'cancelled';
/** Calendar date without a time zone, always `YYYY-MM-DD`. */
export type ISODate = string;

export interface Cycle {
  every: number;
  unit: CycleUnit;
}

/** AES-GCM ciphertext, both fields base64. */
export interface Cipher {
  iv: string;
  ct: string;
}

export interface PricePoint {
  date: ISODate;
  price: number;
  currency: string;
}

export interface Payment {
  date: ISODate;
  /** The user's own share of the charge. */
  amount: number;
  currency: string;
}

export interface Subscription {
  id: string;
  name: string;
  /** Key of the catalog entry this was created from, if any. */
  service?: string;
  color: string;
  categoryId: string;
  price: number;
  currency: string;
  cycle: Cycle;
  /** Next charge, trial end, or the day access ends (cancelled). */
  nextDate: ISODate;
  /** Preferred day of month, so a 31st does not drift to the 28th forever. */
  billingDay?: number;
  /** Charged automatically; otherwise it sits overdue until marked as paid. */
  autoRenew: boolean;
  status: SubStatus;
  /** Number of people the price is split between. */
  share: number;
  paymentMethod?: string;
  url?: string;
  notes?: string;
  /** Per-subscription reminder override; null/undefined means "use the global setting". */
  remindDays?: number[] | null;
  /** Encrypted JSON of {@link Credentials}. */
  credentials?: Cipher | null;
  priceHistory: PricePoint[];
  payments: Payment[];
  createdAt: string;
  updatedAt: string;
}

export interface Credentials {
  login: string;
  password: string;
  note: string;
}

export interface Category {
  id: string;
  /** Custom name; built-in categories fall back to a translated name. */
  name?: string;
  builtin?: string;
  color: string;
  emoji: string;
  order: number;
}

export interface VaultMeta {
  v: 1;
  salt: string;
  iter: number;
  /** A known plaintext encrypted with the derived key, used to verify the password. */
  check: Cipher;
}

export type ThemeMode = 'system' | 'light' | 'dark';
export type AccentKey = 'vermilion' | 'cobalt' | 'emerald' | 'violet' | 'amber' | 'rose' | 'ink';
export type DateFormat = 'auto' | 'dmy' | 'mdy' | 'ymd';
export type SortKey = 'date' | 'price' | 'name';

export interface BackupSettings {
  /** 0 turns reminders off. */
  intervalDays: number;
  /** Encrypt the whole file, not just the stored passwords. */
  encrypt: boolean;
  lastAt: string | null;
  /** Number of automatic copies kept on Android. */
  keep: number;
}

export interface Settings {
  onboarded: boolean;
  lang: Lang;
  /** null means "use the translated default name". */
  appName: string | null;
  currency: string;
  /** How many units of the base currency one unit of the key currency is worth. */
  rates: Record<string, number>;
  ratesAuto: boolean;
  ratesUpdatedAt: string | null;
  dateFormat: DateFormat;
  /** 0 = Sunday, 1 = Monday, 6 = Saturday. */
  weekStart: 0 | 1 | 6;
  notifications: boolean;
  remindDays: number[];
  notifyTime: string;
  theme: ThemeMode;
  accent: AccentKey;
  density: 'cozy' | 'compact';
  hideAmounts: boolean;
  sort: SortKey;
  /** How many days ahead the home screen lists. */
  horizonDays: number;
  backup: BackupSettings;
  lockOnLaunch: boolean;
  /** Minutes in the background before the vault locks; 0 = only when the app closes. */
  autoLockMin: number;
  /** Desktop app: closing the window hides it to the tray, so reminders keep arriving. */
  trayOnClose: boolean;
}
