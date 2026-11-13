import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sheet } from '../components/Sheet';
import { Icon } from '../components/icons';
import { PasswordInput } from '../components/ui';
import { createVault, decryptText, encryptText, openVault } from '../lib/crypto';
import { db, kvSet } from '../lib/db';
import type { Cipher, Credentials, VaultMeta } from '../lib/types';
import { useApp } from './app';
import { useDialogs } from './dialogs';

interface VaultValue {
  ready: boolean;
  meta: VaultMeta | null;
  exists: boolean;
  unlocked: boolean;
  key: CryptoKey | null;
  unlock: (password: string) => Promise<boolean>;
  lock: () => void;
  /** Returns the key, asking for the master password if the vault is locked. */
  ensure: () => Promise<CryptoKey | null>;
  /** Walks the user through creating a master password. */
  setup: () => Promise<CryptoKey | null>;
  change: () => Promise<boolean>;
  /** Removes the vault together with every stored login. */
  destroy: () => Promise<boolean>;
  read: (cipher: Cipher) => Promise<Credentials | null>;
  seal: (c: Credentials) => Promise<Cipher | null>;
}

const Ctx = createContext<VaultValue | null>(null);

export function useVault(): VaultValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('VaultProvider is missing');
  return v;
}

interface Held {
  key: CryptoKey;
  salt: string;
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const { t, settings } = useApp();
  const dialogs = useDialogs();
  const row = useLiveQuery(async () => ({ meta: ((await db.kv.get('vault'))?.value as VaultMeta | undefined) ?? null }), []);
  const meta = row?.meta ?? null;
  const [held, setHeld] = useState<Held | null>(null);
  const [creating, setCreating] = useState<{ done: (password: string | null) => void; change: boolean } | null>(null);

  // A key only counts while it matches the vault on disk (an import may replace the vault).
  const key = held && meta && held.salt === meta.salt ? held.key : null;
  const metaRef = useRef(meta);
  metaRef.current = meta;
  const keyRef = useRef(key);
  keyRef.current = key;

  const lock = useCallback(() => setHeld(null), []);

  const unlock = useCallback(async (password: string) => {
    const m = metaRef.current;
    if (!m) return false;
    const k = await openVault(password, m);
    if (!k) return false;
    setHeld({ key: k, salt: m.salt });
    keyRef.current = k;
    return true;
  }, []);

  const ensure = useCallback(async () => {
    if (keyRef.current) return keyRef.current;
    if (!metaRef.current) return null;
    const pw = await dialogs.askPassword({ title: t('vault.unlockTitle'), body: t('vault.unlockBody'), confirm: t('vault.unlock'), check: unlock });
    return pw ? keyRef.current : null;
  }, [dialogs, t, unlock]);

  const askNew = useCallback(
    (change: boolean) => new Promise<string | null>((resolve) => setCreating({ done: resolve, change })),
    [],
  );

  const setup = useCallback(async () => {
    if (metaRef.current) return ensure();
    const password = await askNew(false);
    if (!password) return null;
    const created = await createVault(password);
    await kvSet('vault', created.meta);
    metaRef.current = created.meta;
    keyRef.current = created.key;
    setHeld({ key: created.key, salt: created.meta.salt });
    return created.key;
  }, [askNew, ensure]);

  const change = useCallback(async () => {
    const oldKey = await ensure();
    if (!oldKey) return false;
    const password = await askNew(true);
    if (!password) return false;
    const created = await createVault(password);
    const subs = await db.subs.toArray();
    const moved: typeof subs = [];
    for (const s of subs) {
      if (!s.credentials) continue;
      moved.push({ ...s, credentials: await encryptText(created.key, await decryptText(oldKey, s.credentials)) });
    }
    await db.transaction('rw', db.subs, db.kv, async () => {
      await db.subs.bulkPut(moved);
      await kvSet('vault', created.meta);
    });
    metaRef.current = created.meta;
    keyRef.current = created.key;
    setHeld({ key: created.key, salt: created.meta.salt });
    return true;
  }, [askNew, ensure]);

  const destroy = useCallback(async () => {
    const ok = await dialogs.confirm({
      title: t('vault.removeTitle'),
      body: t('vault.removeBody'),
      confirm: t('vault.removeConfirm'),
      danger: true,
    });
    if (!ok) return false;
    await db.transaction('rw', db.subs, db.kv, async () => {
      await db.subs.toCollection().modify((s) => {
        s.credentials = null;
      });
      await db.kv.delete('vault');
    });
    setHeld(null);
    return true;
  }, [dialogs, t]);

  const read = useCallback(
    async (cipher: Cipher): Promise<Credentials | null> => {
      const k = await ensure();
      if (!k) return null;
      try {
        const raw = JSON.parse(await decryptText(k, cipher)) as Partial<Credentials>;
        return { login: String(raw.login ?? ''), password: String(raw.password ?? ''), note: String(raw.note ?? '') };
      } catch {
        return null;
      }
    },
    [ensure],
  );

  const seal = useCallback(
    async (c: Credentials) => {
      const k = keyRef.current ?? (await setup());
      return k ? encryptText(k, JSON.stringify(c)) : null;
    },
    [setup],
  );

  // Lock again after the app has been in the background for a while.
  useEffect(() => {
    let hiddenAt = 0;
    const onChange = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && settings.autoLockMin > 0 && Date.now() - hiddenAt >= settings.autoLockMin * 60_000) setHeld(null);
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, [settings.autoLockMin]);

  const value = useMemo<VaultValue>(
    () => ({ ready: !!row, meta, exists: !!meta, unlocked: !!key, key, unlock, lock, ensure, setup, change, destroy, read, seal }),
    [row, meta, key, unlock, lock, ensure, setup, change, destroy, read, seal],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <Sheet
        open={!!creating}
        title={creating?.change ? t('vault.changeTitle') : t('vault.createTitle')}
        onClose={() => {
          creating?.done(null);
          setCreating(null);
        }}
      >
        {creating && (
          <NewPasswordForm
            onDone={(pw) => {
              creating.done(pw);
              setCreating(null);
            }}
          />
        )}
      </Sheet>
    </Ctx.Provider>
  );
}

/** 0–4: a rough guide, not a guarantee. */
export function passwordStrength(pw: string): number {
  if (!pw) return 0;
  const classes = [/[a-zа-яё]/, /[A-ZА-ЯЁ]/, /\d/, /[^\p{L}\d]/u].filter((r) => r.test(pw)).length;
  if (pw.length < 8) return 1;
  if (pw.length >= 20 || (pw.length >= 14 && classes >= 3)) return 4;
  if (pw.length >= 12 || (pw.length >= 10 && classes >= 3)) return 3;
  return 2;
}

function NewPasswordForm({ onDone }: { onDone: (password: string | null) => void }) {
  const { t } = useApp();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [busy, setBusy] = useState(false);
  const level = passwordStrength(a);
  const tooShort = a.length > 0 && a.length < 8;
  const mismatch = b.length > 0 && a !== b;
  const valid = a.length >= 8 && a === b;

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid || busy) return;
        setBusy(true);
        onDone(a);
      }}
    >
      <p className="muted">{t('vault.createBody')}</p>
      <label className="field">
        <span className="field__label">{t('vault.new')}</span>
        <PasswordInput value={a} onChange={setA} autoFocus autoComplete="new-password" />
        <div className="strength" data-level={level} aria-hidden>
          <i />
          <i />
          <i />
          <i />
        </div>
        {tooShort ? <span className="field__error">{t('vault.tooShort')}</span> : <span className="field__hint">{t('vault.hint')}</span>}
      </label>
      <label className="field">
        <span className="field__label">{t('vault.repeat')}</span>
        <PasswordInput value={b} onChange={setB} autoComplete="new-password" />
        {mismatch && <span className="field__error">{t('vault.mismatch')}</span>}
      </label>
      <div className="note note--accent">
        <Icon name="alert" />
        <div className="note__body">{t('vault.warning')}</div>
      </div>
      <div className="btn-row">
        <button type="button" className="btn btn--ghost" onClick={() => onDone(null)}>
          {t('common.cancel')}
        </button>
        <button type="submit" className="btn" disabled={!valid || busy}>
          {busy ? t('common.wait') : t('vault.save')}
        </button>
      </div>
    </form>
  );
}
