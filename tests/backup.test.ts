import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyBackup, BackupError, collectBackup, decryptBackup, parseBackup, serializeEncrypted, serializePlain } from '../src/lib/backup';
import { createVault, decryptText, encryptText, generatePassword, openVault } from '../src/lib/crypto';
import { db, kvSet } from '../src/lib/db';
import { ensureDefaults } from '../src/lib/settings';
import { blankSubscription } from '../src/lib/store';

const ITER = 2000; // fast in tests; the app uses 600 000

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureDefaults();
});

describe('crypto', () => {
  it('opens only with the right password', async () => {
    const { meta } = await createVault('correct horse battery', ITER);
    expect(await openVault('correct horse battery', meta)).not.toBeNull();
    expect(await openVault('wrong', meta)).toBeNull();
  });

  it('generates strong passwords', () => {
    const pw = generatePassword(24);
    expect(pw).toHaveLength(24);
    expect(/[a-z]/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw)).toBe(true);
  });
});

describe('backup', () => {
  it('round-trips a plain backup and strips unsafe values', async () => {
    const s = { ...blankSubscription({ currency: 'RUB' }), name: 'Kino', price: 299, url: 'javascript:alert(1)' };
    await db.subs.put(s);
    const text = serializePlain(await collectBackup());
    const parsed = parseBackup(text);
    if (parsed.kind !== 'plain') throw new Error('expected plain');
    expect(parsed.data.subscriptions[0].name).toBe('Kino');
    expect(parsed.data.subscriptions[0].url).toBeUndefined();
  });

  it('rejects foreign files', () => {
    expect(() => parseBackup('{"hello":1}')).toThrow(BackupError);
    expect(() => parseBackup('not json')).toThrow(BackupError);
  });

  it('encrypts the whole file with the master password', async () => {
    const { meta, key } = await createVault('master-password', ITER);
    await kvSet('vault', meta);
    await db.subs.put({ ...blankSubscription({ currency: 'USD' }), name: 'Secret service', price: 5 });
    const text = await serializeEncrypted(await collectBackup(), meta, key);
    expect(text).not.toContain('Secret service');
    const parsed = parseBackup(text);
    if (parsed.kind !== 'encrypted') throw new Error('expected encrypted');
    await expect(decryptBackup(parsed.file, 'nope')).rejects.toThrow(BackupError);
    const { data } = await decryptBackup(parsed.file, 'master-password');
    expect(data.subscriptions[0].name).toBe('Secret service');
  });

  it('merges without duplicates and moves logins between vaults', async () => {
    const other = await createVault('other-device', ITER);
    const mine = await createVault('this-device', ITER);
    const s = { ...blankSubscription({ currency: 'USD' }), id: 's1', name: 'Mail', price: 3, credentials: await encryptText(other.key, '{"login":"me"}') };
    const backup = { subscriptions: [s], categories: [], settings: {}, vault: other.meta };

    await kvSet('vault', mine.meta);
    await db.subs.put({ ...blankSubscription({ currency: 'USD' }), id: 'dup', name: 'mail', price: 3 });

    const r1 = await applyBackup(backup, { mode: 'merge', reencrypt: async (c) => encryptText(mine.key, await decryptText(other.key, c)) });
    expect(r1).toMatchObject({ added: 0, skipped: 1 });

    await db.subs.delete('dup');
    const r2 = await applyBackup(backup, { mode: 'merge', reencrypt: async (c) => encryptText(mine.key, await decryptText(other.key, c)) });
    expect(r2.added).toBe(1);
    const stored = await db.subs.get('s1');
    expect(await decryptText(mine.key, stored!.credentials!)).toBe('{"login":"me"}');
  });

  it('replaces everything, adopting the backup vault', async () => {
    const other = await createVault('other-device', ITER);
    await db.subs.put({ ...blankSubscription({ currency: 'USD' }), id: 'old', name: 'Old', price: 1 });
    const r = await applyBackup({ subscriptions: [], categories: [], settings: { lang: 'zh' }, vault: other.meta }, { mode: 'replace' });
    expect(r.vaultChanged).toBe(true);
    expect(await db.subs.count()).toBe(0);
    expect(await db.categories.count()).toBeGreaterThan(0);
  });
});
