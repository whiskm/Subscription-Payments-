import Dexie, { type Table } from 'dexie';
import type { Category, Subscription } from './types';

interface KV {
  key: string;
  value: unknown;
}

/** Everything lives in the browser's IndexedDB. There is no server copy. */
export class AppDB extends Dexie {
  subs!: Table<Subscription, string>;
  categories!: Table<Category, string>;
  kv!: Table<KV, string>;

  constructor() {
    super('subscription-payments');
    this.version(1).stores({
      subs: 'id, nextDate, status',
      categories: 'id, order',
      kv: 'key',
    });
  }
}

export const db = new AppDB();

export async function kvGet<T>(key: string): Promise<T | undefined> {
  return (await db.kv.get(key))?.value as T | undefined;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await db.kv.put({ key, value });
}

/** Asks the browser not to evict our data under storage pressure. */
export async function requestPersistence(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}
