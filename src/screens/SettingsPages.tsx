import { useMemo, useState, type CSSProperties } from 'react';
import { Icon } from '../components/icons';
import { Sheet } from '../components/Sheet';
import { Row, Section, Swatches, Switch } from '../components/ui';
import {
  applyBackup,
  BackupError,
  decryptBackup,
  parseBackup,
  vaultRelation,
  type BackupData,
  type ImportResult,
} from '../lib/backup';
import { FALLBACK_CATEGORY, SWATCHES } from '../lib/categories';
import { decryptText, encryptText, newId, openVault } from '../lib/crypto';
import { db } from '../lib/db';
import { pickTextFile } from '../lib/files';
import { parseAmount } from '../lib/money';
import { refreshRates } from '../lib/rates';
import type { Category, Cipher } from '../lib/types';
import { useApp } from '../state/app';
import { useDialogs } from '../state/dialogs';
import { back } from '../state/router';
import { useVault } from '../state/vault';
import { SettingsBack } from './Settings';

// ---- Exchange rates --------------------------------------------------------

export function Rates() {
  const { settings, update, subs, t, date } = useApp();
  const { toast } = useDialogs();
  const [busy, setBusy] = useState(false);
  const used = useMemo(() => [...new Set(subs.map((s) => s.currency))].filter((c) => c !== settings.currency).sort(), [subs, settings.currency]);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const refresh = async () => {
    setBusy(true);
    try {
      await refreshRates(true);
      setDraft({});
      toast(t('rates.updated'));
    } catch {
      toast(t('rates.failed'));
    } finally {
      setBusy(false);
    }
  };

  const commit = async (code: string) => {
    const text = draft[code];
    if (text === undefined) return;
    const value = parseAmount(text);
    const rates = { ...settings.rates };
    if (value && value > 0) rates[code] = value;
    else delete rates[code];
    await update({ rates });
  };

  return (
    <div className="screen screen--plain">
      <SettingsBack title={t('settings.rates')} />
      <div className="card rows">
        <Row icon="globe" label={t('rates.auto')} hint={t('rates.autoHint')}>
          <Switch label={t('rates.auto')} checked={settings.ratesAuto} onChange={(ratesAuto) => update({ ratesAuto })} />
        </Row>
        <Row icon="refresh" label={t('rates.refresh')} value={settings.ratesUpdatedAt ? date(settings.ratesUpdatedAt.slice(0, 10)) : '—'} onClick={busy ? undefined : refresh} />
      </div>

      <Section title={t('rates.manual')} aside={settings.currency}>
        {used.length ? (
          <div className="card rows">
            {used.map((code) => (
              <label key={code} className="row">
                <span className="row__text num" style={{ fontWeight: 600 }}>
                  1 {code} =
                </span>
                <input
                  className="input input--mono"
                  style={{ width: 120, height: 38, textAlign: 'right' }}
                  inputMode="decimal"
                  placeholder="?"
                  value={draft[code] ?? (settings.rates[code] ? String(settings.rates[code]) : '')}
                  onChange={(e) => setDraft({ ...draft, [code]: e.target.value })}
                  onBlur={() => void commit(code)}
                />
                <span className="num muted" style={{ width: 40 }}>
                  {settings.currency}
                </span>
              </label>
            ))}
          </div>
        ) : (
          <div className="note">
            <Icon name="coins" />
            <div className="note__body muted">{t('rates.none')}</div>
          </div>
        )}
      </Section>
      <p className="muted" style={{ fontSize: 13 }}>
        {t('rates.privacy')}
      </p>
    </div>
  );
}

// ---- Categories ------------------------------------------------------------

export function Categories() {
  const { categories, subs, t, categoryName } = useApp();
  const { confirm } = useDialogs();
  const [editing, setEditing] = useState<Category | null>(null);

  const remove = async (c: Category) => {
    const count = subs.filter((s) => s.categoryId === c.id).length;
    if (!(await confirm({ title: t('cats.deleteTitle', { name: categoryName(c) }), body: count ? t('cats.deleteBody', { n: count }) : undefined, confirm: t('common.delete'), danger: true }))) return;
    await db.transaction('rw', db.subs, db.categories, async () => {
      await db.subs.where('id').anyOf(subs.filter((s) => s.categoryId === c.id).map((s) => s.id)).modify({ categoryId: FALLBACK_CATEGORY });
      await db.categories.delete(c.id);
    });
    setEditing(null);
  };

  const move = async (c: Category, dir: -1 | 1) => {
    const i = categories.findIndex((x) => x.id === c.id);
    const j = i + dir;
    if (j < 0 || j >= categories.length) return;
    const list = [...categories];
    [list[i], list[j]] = [list[j], list[i]];
    await db.categories.bulkPut(list.map((x, order) => ({ ...x, order })));
  };

  return (
    <div className="screen screen--plain">
      <SettingsBack title={t('settings.categories')} />
      <div className="card rows">
        {categories.map((c, i) => (
          <div key={c.id} className="row">
            <span className="mark" style={{ '--brand': c.color, '--size': '34px' } as CSSProperties}>
              <span style={{ fontSize: 17 }}>{c.emoji}</span>
            </span>
            <button type="button" className="row__text" style={{ textAlign: 'left' }} onClick={() => setEditing(c)}>
              <div className="row__label">{categoryName(c)}</div>
              <div className="row__hint">{subs.filter((s) => s.categoryId === c.id).length || '—'}</div>
            </button>
            <button type="button" className="icon-btn icon-btn--bare" disabled={i === 0} aria-label="↑" onClick={() => move(c, -1)} style={{ opacity: i === 0 ? 0.3 : 1 }}>
              <Icon name="chevL" size={18} className="rot90" />
            </button>
            <button type="button" className="icon-btn icon-btn--bare" disabled={i === categories.length - 1} aria-label="↓" onClick={() => move(c, 1)} style={{ opacity: i === categories.length - 1 ? 0.3 : 1 }}>
              <Icon name="chevR" size={18} className="rot90" />
            </button>
          </div>
        ))}
      </div>
      <button className="btn btn--ghost" onClick={() => setEditing({ id: newId(), color: SWATCHES[7], emoji: '⭐', order: categories.length, name: '' })}>
        <Icon name="plus" size={18} />
        {t('cats.add')}
      </button>

      <Sheet open={!!editing} title={editing && categories.some((c) => c.id === editing.id) ? t('cats.edit') : t('cats.add')} onClose={() => setEditing(null)}>
        {editing && <CategoryForm initial={editing} onDone={() => setEditing(null)} onDelete={editing.id !== FALLBACK_CATEGORY && categories.some((c) => c.id === editing.id) ? () => remove(editing) : undefined} />}
      </Sheet>
    </div>
  );
}

const EMOJI = ['⭐', '🎬', '🎧', '✨', '🧰', '☁️', '🎮', '📚', '🎓', '💪', '🔐', '📶', '🛍️', '🏠', '🚗', '🍔', '✈️', '🐾', '👶', '💼', '📰', '🎨', '💊', '🗂️'];

function CategoryForm({ initial, onDone, onDelete }: { initial: Category; onDone: () => void; onDelete?: () => void }) {
  const { t, categoryName } = useApp();
  const [c, setC] = useState<Category>({ ...initial, name: initial.name ?? (initial.builtin ? categoryName(initial) : '') });
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        const name = c.name?.trim();
        if (!name) return;
        // Built-in categories keep following the language until they are renamed.
        const keepBuiltin = initial.builtin && name === categoryName({ ...initial, name: undefined });
        await db.categories.put({ ...c, name: keepBuiltin ? undefined : name });
        onDone();
      }}
    >
      <label className="field">
        <span className="field__label">{t('cats.name')}</span>
        <input className="input input--big" value={c.name ?? ''} autoFocus maxLength={40} onChange={(e) => setC({ ...c, name: e.target.value })} />
      </label>
      <div className="field">
        <span className="field__label">{t('cats.icon')}</span>
        <div className="chips">
          {EMOJI.map((e) => (
            <button type="button" key={e} className="chip" aria-pressed={c.emoji === e} onClick={() => setC({ ...c, emoji: e })} style={{ padding: '0 10px', fontSize: 18 }}>
              {e}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span className="field__label">{t('edit.color')}</span>
        <Swatches label={t('edit.color')} value={c.color} colors={SWATCHES} onChange={(color) => setC({ ...c, color })} />
      </div>
      <div className="btn-row">
        {onDelete && (
          <button type="button" className="btn btn--danger" onClick={onDelete}>
            {t('common.delete')}
          </button>
        )}
        <button type="submit" className="btn" disabled={!c.name?.trim()}>
          {t('common.save')}
        </button>
      </div>
    </form>
  );
}

// ---- Import ----------------------------------------------------------------

interface Loaded {
  data: BackupData;
  exportedAt: string | null;
  /** Key of the backup's own vault, when we already have it. */
  key: CryptoKey | null;
  relation: Awaited<ReturnType<typeof vaultRelation>>;
}

export function Import() {
  const { t, tn, date, subs } = useApp();
  const vault = useVault();
  const { askPassword, toast } = useDialogs();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>(subs.length ? 'merge' : 'replace');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    setError(null);
    setResult(null);
    const text = await pickTextFile('.json,application/json');
    if (!text) return;
    try {
      const parsed = parseBackup(text);
      if (parsed.kind === 'plain') {
        setLoaded({ data: parsed.data, exportedAt: parsed.exportedAt, key: null, relation: await vaultRelation(parsed.data) });
      } else {
        let opened: { data: BackupData; key: CryptoKey } | null = null;
        await askPassword({
          title: t('import.encryptedTitle'),
          body: t('import.encryptedBody'),
          confirm: t('vault.unlock'),
          check: async (pw) => {
            try {
              opened = await decryptBackup(parsed.file, pw);
              return true;
            } catch (e) {
              if (e instanceof BackupError && e.code === 'password') return false;
              throw e;
            }
          },
        });
        const o = opened as { data: BackupData; key: CryptoKey } | null;
        if (!o) return;
        setLoaded({ data: o.data, exportedAt: parsed.exportedAt, key: o.key, relation: await vaultRelation(o.data) });
      }
    } catch (e) {
      setError(t(e instanceof BackupError && e.code === 'newer' ? 'import.newer' : 'import.invalid'));
    }
  };

  const run = async () => {
    if (!loaded) return;
    setBusy(true);
    try {
      let reencrypt: ((c: Cipher) => Promise<Cipher>) | undefined;
      if (mode === 'merge' && loaded.relation === 'different') {
        // Passwords in the file are locked with the other device's master password.
        let fromKey = loaded.key;
        if (!fromKey && loaded.data.vault) {
          const meta = loaded.data.vault;
          await askPassword({
            title: t('import.otherVaultTitle'),
            body: t('import.otherVaultBody'),
            confirm: t('vault.unlock'),
            check: async (pw) => !!(fromKey = await openVault(pw, meta)),
          });
        }
        const toKey = fromKey ? await vault.ensure() : null;
        if (fromKey && toKey) {
          const from = fromKey;
          reencrypt = async (c) => encryptText(toKey, await decryptText(from, c));
        }
      }
      const r = await applyBackup(loaded.data, { mode, reencrypt });
      if (r.vaultChanged) vault.lock();
      setResult(r);
      setLoaded(null);
      toast(t('import.done'));
    } catch {
      setError(t('import.failed'));
    } finally {
      setBusy(false);
    }
  };

  const withCreds = loaded?.data.subscriptions.filter((s) => s.credentials).length ?? 0;

  return (
    <div className="screen screen--plain">
      <SettingsBack title={t('data.import')} />

      {!loaded && !result && (
        <div className="empty">
          <div className="ghost-ticket">
            <div>
              <i style={{ width: '58%' }} />
              <i style={{ width: '36%' }} />
            </div>
            <div>
              <Icon name="upload" size={28} />
            </div>
          </div>
          <h2 className="empty__title">{t('import.title')}</h2>
          <p className="empty__text">{t('import.text')}</p>
          <button className="btn btn--accent" onClick={pick}>
            <Icon name="file" size={18} />
            {t('import.pick')}
          </button>
        </div>
      )}

      {error && (
        <div className="note note--accent">
          <Icon name="alert" />
          <div className="note__body">{error}</div>
        </div>
      )}

      {loaded && (
        <>
          <div className="receipt">
            <div className="receipt__paper">
              <div className="receipt__head mono">
                <span>{t('import.file')}</span>
                <span>{loaded.exportedAt ? date(loaded.exportedAt.slice(0, 10), { year: true }) : '—'}</span>
              </div>
              <div className="receipt__total">{loaded.data.subscriptions.length}</div>
              <div className="receipt__sub mono">{tn('subscriptions', loaded.data.subscriptions.length).replace(/^\d+\s?/, '')}</div>
              <div className="receipt__rows">
                <div className="leader">
                  <span>{t('settings.categories')}</span>
                  <span>{loaded.data.categories.length}</span>
                </div>
                <div className="leader">
                  <span>{t('import.withCreds')}</span>
                  <span>{withCreds}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="stack-v stack-v--tight" role="radiogroup">
            <button type="button" role="radio" aria-checked={mode === 'merge'} className="choice" onClick={() => setMode('merge')}>
              <div style={{ flex: 1 }}>
                {t('import.merge')}
                <div className="row__hint" style={{ fontWeight: 400 }}>
                  {t('import.mergeHint')}
                </div>
              </div>
              <Icon name="check" className="choice__check" />
            </button>
            <button type="button" role="radio" aria-checked={mode === 'replace'} className="choice" onClick={() => setMode('replace')}>
              <div style={{ flex: 1 }}>
                {t('import.replace')}
                <div className="row__hint" style={{ fontWeight: 400 }}>
                  {t('import.replaceHint')}
                </div>
              </div>
              <Icon name="check" className="choice__check" />
            </button>
          </div>

          {withCreds > 0 && loaded.relation === 'different' && (
            <div className="note">
              <Icon name="key" />
              <div className="note__body muted">{t(mode === 'merge' ? 'import.credsMerge' : 'import.credsReplace')}</div>
            </div>
          )}

          <div className="btn-row">
            <button className="btn btn--ghost" onClick={() => setLoaded(null)}>
              {t('common.cancel')}
            </button>
            <button className={mode === 'replace' ? 'btn btn--danger' : 'btn'} disabled={busy} onClick={run}>
              {busy ? t('common.wait') : t('import.run')}
            </button>
          </div>
        </>
      )}

      {result && (
        <div className="stack-v">
          <div className="card card--pad history">
            <div className="leader leader--strong">
              <span>{t('import.added')}</span>
              <span>{result.added}</span>
            </div>
            <div className="leader">
              <span>{t('import.updated')}</span>
              <span>{result.updated}</span>
            </div>
            <div className="leader">
              <span>{t('import.skipped')}</span>
              <span>{result.skipped}</span>
            </div>
            {result.credentialsDropped > 0 && (
              <div className="leader">
                <span>{t('import.credsDropped')}</span>
                <span>{result.credentialsDropped}</span>
              </div>
            )}
          </div>
          <button className="btn" onClick={() => back('/')}>
            {t('common.done')}
          </button>
        </div>
      )}
    </div>
  );
}
