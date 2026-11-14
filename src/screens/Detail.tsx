import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Icon } from '../components/icons';
import { Sheet } from '../components/Sheet';
import { Barcode, Punches, ServiceMark, Stamp, ticketCode, useStub } from '../components/Ticket';
import { BackBar } from '../components/TopBar';
import { IconButton, Leader, PasswordInput, Row, Section } from '../components/ui';
import { generatePassword } from '../lib/crypto';
import { db } from '../lib/db';
import { clearClipboard, copyText } from '../lib/files';
import { toBase } from '../lib/money';
import { cycleProgress, daysLeft, monthlyCost, ownShare } from '../lib/schedule';
import { deleteSubscription, payNow, setStatus } from '../lib/store';
import type { Credentials, Subscription } from '../lib/types';
import { useApp } from '../state/app';
import { useDialogs } from '../state/dialogs';
import { back, go } from '../state/router';
import { useVault } from '../state/vault';

export function Detail({ id }: { id: string }) {
  const app = useApp();
  const { subs, t, tn, money, date, today, settings, category, categoryName, cycleLabel, dueLabel } = app;
  const { confirm, toast } = useDialogs();
  const sub = subs.find((s) => s.id === id);
  const [menu, setMenu] = useState(false);

  if (!sub) {
    return (
      <div className="screen screen--plain">
        <BackBar />
        <div className="empty">
          <h2 className="empty__title">{t('detail.missing')}</h2>
        </div>
      </div>
    );
  }

  const cat = category(sub.categoryId);
  const left = daysLeft(sub, today);
  const monthly = monthlyCost(sub);
  const inBase = sub.currency !== settings.currency ? toBase(monthly, sub.currency, settings.currency, settings.rates) : null;
  const canPay = sub.status === 'active' || sub.status === 'trial';

  const pay = async () => {
    const next = await payNow(sub.id, today);
    if (next) toast(t('detail.paidToast', { date: date(next.nextDate) }));
  };

  const remove = async () => {
    setMenu(false);
    if (!(await confirm({ title: t('detail.deleteTitle', { name: sub.name }), body: t('detail.deleteBody'), confirm: t('common.delete'), danger: true }))) return;
    await deleteSubscription(sub.id);
    back('/list');
  };

  const change = async (status: Subscription['status']) => {
    setMenu(false);
    await setStatus(sub.id, status, today);
  };

  return (
    <div className="screen screen--plain">
      <BackBar
        fallback="/list"
        actions={
          <div className="top__actions">
            <IconButton icon="edit" label={t('common.edit')} onClick={() => go(`/sub/${sub.id}/edit`)} />
            <IconButton icon="more" label={t('common.more')} onClick={() => setMenu(true)} />
          </div>
        }
      />

      <Pass sub={sub} />

      {canPay && (
        <div className="btn-row">
          <button className={left <= 0 ? 'btn btn--accent' : 'btn'} onClick={pay}>
            <Icon name="check" size={18} />
            {t(sub.autoRenew ? 'detail.markPaid' : 'detail.renewed')}
          </button>
          {sub.url && (
            <a className="btn btn--ghost" href={sub.url} target="_blank" rel="noopener noreferrer">
              <Icon name="external" size={18} />
              {t('detail.manage')}
            </a>
          )}
        </div>
      )}
      {!canPay && (
        <div className="btn-row">
          <button className="btn" onClick={() => change('active')}>
            <Icon name="play" size={18} />
            {t('detail.resume')}
          </button>
          {sub.url && (
            <a className="btn btn--ghost" href={sub.url} target="_blank" rel="noopener noreferrer">
              <Icon name="external" size={18} />
              {t('detail.manage')}
            </a>
          )}
        </div>
      )}

      <div className="facts">
        <Fact label={t(sub.status === 'cancelled' ? 'detail.endsOn' : sub.status === 'trial' ? 'detail.trialEnds' : sub.autoRenew ? 'detail.nextPayment' : 'detail.expires')}>
          {date(sub.nextDate, { year: true })}
          <div className="muted" style={{ fontWeight: 400, fontSize: 13 }}>
            {dueLabel(sub.nextDate)}
          </div>
        </Fact>
        <Fact label={t('detail.billing')}>
          {cycleLabel(sub.cycle)}
          <div className="muted" style={{ fontWeight: 400, fontSize: 13 }}>
            {t(sub.autoRenew ? 'detail.auto' : 'detail.manual')}
          </div>
        </Fact>
        <Fact label={t('detail.perMonth')}>
          {money(monthly, sub.currency)}
          {inBase !== null && (
            <div className="muted" style={{ fontWeight: 400, fontSize: 13 }}>
              ≈ {money(inBase)}
            </div>
          )}
        </Fact>
        <Fact label={t('detail.perYear')}>
          {money(monthly * 12, sub.currency, { round: true })}
          {inBase !== null && (
            <div className="muted" style={{ fontWeight: 400, fontSize: 13 }}>
              ≈ {money(inBase * 12, undefined, { round: true })}
            </div>
          )}
        </Fact>
        <Fact label={t('edit.category')}>
          {cat.emoji} {categoryName(cat)}
        </Fact>
        <Fact label={t('edit.payment')}>{sub.paymentMethod || '—'}</Fact>
        {sub.share > 1 && (
          <Fact label={t('edit.share')} wide>
            {tn('people', sub.share)} · {t('detail.fullPrice')} {money(sub.price, sub.currency)}
          </Fact>
        )}
        {sub.notes && (
          <Fact label={t('edit.notes')} wide>
            <span style={{ fontWeight: 400, whiteSpace: 'pre-wrap' }}>{sub.notes}</span>
          </Fact>
        )}
      </div>

      <CredentialsCard sub={sub} />

      {(sub.payments.length > 0 || sub.priceHistory.length > 1) && (
        <Section title={t('detail.history')} aside={sub.payments.length ? tn('payments', sub.payments.length) : undefined}>
          <div className="card card--pad history">
            {sub.priceHistory.length > 1 &&
              sub.priceHistory
                .slice(-4)
                .reverse()
                .map((p, i) => <Leader key={`p${i}`} label={`${date(p.date, { year: true })} · ${t('detail.priceSet')}`} value={money(p.price, p.currency)} strong />)}
            {sub.payments
              .slice(-8)
              .reverse()
              .map((p, i) => (
                <Leader key={`c${i}`} label={date(p.date, { year: true })} value={money(p.amount, p.currency)} />
              ))}
          </div>
        </Section>
      )}

      <div className="mono center">
        {ticketCode(sub.id)} · {t('detail.added')} {date(sub.createdAt.slice(0, 10), { year: true })}
      </div>

      <Sheet open={menu} title={sub.name} onClose={() => setMenu(false)}>
        <div className="card rows" style={{ boxShadow: 'inset 0 0 0 1.5px var(--line)' }}>
          {sub.status !== 'paused' && <Row icon="pause" label={t('detail.pause')} hint={t('detail.pauseHint')} onClick={() => change('paused')} />}
          {sub.status !== 'active' && <Row icon="play" label={t('detail.makeActive')} onClick={() => change('active')} />}
          {sub.status !== 'cancelled' && <Row icon="ban" label={t('detail.cancel')} hint={t('detail.cancelHint')} onClick={() => change('cancelled')} />}
          <Row icon="trash" label={t('common.delete')} danger onClick={remove} />
        </div>
      </Sheet>
    </div>
  );

}

function Fact({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'fact fact--wide' : 'fact'}>
      <div className="mono">{label}</div>
      <div className="fact__value">{children}</div>
    </div>
  );
}

function Pass({ sub }: { sub: Subscription }) {
  const { t, money, date, today, category, categoryName, cycleLabel, perLabel } = useApp();
  const cat = category(sub.categoryId);
  const stub = useStub(sub);
  const urgent = stub.urgency === 'overdue' || stub.urgency === 'today' || stub.urgency === 'soon';
  return (
    <motion.div className="pass" style={{ '--brand': sub.color } as CSSProperties} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
      <div className="pass__paper">
        <div className="pass__band" />
        <div className="pass__top">
          <div className="pass__id">
            <ServiceMark name={sub.name} color={sub.color} service={sub.service} size={52} />
            <div style={{ minWidth: 0 }}>
              <div className="pass__name">{sub.name}</div>
              <div className="mono" style={{ marginTop: 6 }}>
                {categoryName(cat)} · {cycleLabel(sub.cycle)}
              </div>
            </div>
          </div>
          {sub.status !== 'active' && (
            <div className="pass__stamp">
              <Stamp big tone={sub.status === 'trial' ? undefined : 'quiet'}>
                {t(`status.${sub.status}`)}
              </Stamp>
            </div>
          )}
          <div className="pass__count">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={sub.nextDate + sub.status}
                className="pass__num"
                data-urgent={urgent ? '' : undefined}
                initial={{ y: -30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 50, opacity: 0, rotate: 8 }}
                transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              >
                {stub.num}
              </motion.div>
            </AnimatePresence>
            <div className="pass__unit">
              {stub.label}
              <small>
                {date(sub.nextDate, { year: true })}
              </small>
            </div>
          </div>
          <div className="pass__punches" aria-hidden>
            <Punches progress={sub.status === 'paused' ? 0 : cycleProgress(sub, today)} count={24} />
          </div>
        </div>
        <div className="pass__stub">
          <div>
            <div className="pass__price">{money(ownShare(sub), sub.currency)}</div>
            <div className="mono" style={{ marginTop: 8 }}>
              {perLabel(sub.cycle)}
            </div>
          </div>
          <Barcode seed={sub.id} />
        </div>
      </div>
    </motion.div>
  );
}

const EMPTY: Credentials = { login: '', password: '', note: '' };

function CredentialsCard({ sub }: { sub: Subscription }) {
  const { t } = useApp();
  const vault = useVault();
  const { toast, confirm } = useDialogs();
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [shown, setShown] = useState(false);
  const [editing, setEditing] = useState<Credentials | null>(null);
  const clearTimer = useRef(0);

  // Forget the decrypted values as soon as the vault locks or the record changes.
  useEffect(() => {
    setCreds(null);
    setShown(false);
  }, [vault.unlocked, sub.id, sub.credentials?.ct]);

  useEffect(() => {
    if (vault.unlocked && sub.credentials) void vault.read(sub.credentials).then(setCreds);
  }, [vault.unlocked, sub.credentials?.ct]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = async () => {
    if (sub.credentials) setCreds(await vault.read(sub.credentials));
  };

  const copy = async (value: string, secret: boolean) => {
    if (!(await copyText(value))) return;
    toast(t(secret ? 'creds.copiedSecret' : 'creds.copied'));
    if (secret) {
      window.clearTimeout(clearTimer.current);
      // Best effort: browsers only allow this while the app is in front.
      clearTimer.current = window.setTimeout(() => void clearClipboard(), 30_000);
    }
  };

  const startEdit = async () => {
    if (sub.credentials) {
      const current = creds ?? (await vault.read(sub.credentials));
      if (current) setEditing(current);
    } else if (await vault.setup()) setEditing(EMPTY);
  };

  const save = async (next: Credentials) => {
    const empty = !next.login && !next.password && !next.note;
    const cipher = empty ? null : await vault.seal(next);
    if (!empty && !cipher) return;
    await db.subs.update(sub.id, { credentials: cipher, updatedAt: new Date().toISOString() });
    setEditing(null);
    toast(t('common.saved'));
  };

  const clear = async () => {
    if (!(await confirm({ title: t('creds.removeTitle'), confirm: t('common.delete'), danger: true }))) return;
    await db.subs.update(sub.id, { credentials: null, updatedAt: new Date().toISOString() });
    setEditing(null);
  };

  return (
    <Section title={t('creds.title')} aside={sub.credentials ? (vault.unlocked ? t('creds.open') : t('creds.locked')) : undefined}>
      {!sub.credentials ? (
        <div className="note">
          <Icon name="key" />
          <div className="note__body">
            <div className="muted">{t('creds.empty')}</div>
            <div className="note__actions">
              <button className="btn btn--small" onClick={startEdit}>
                <Icon name="plus" size={16} />
                {t('creds.add')}
              </button>
            </div>
          </div>
        </div>
      ) : !creds ? (
        <button className="card row" onClick={open}>
          <Icon name="lock" className="row__icon" />
          <div className="row__text">
            <div className="row__label">{t('creds.lockedTitle')}</div>
            <div className="row__hint">{t('creds.lockedHint')}</div>
          </div>
          <span className="btn btn--small">{t('vault.unlock')}</span>
        </button>
      ) : (
        <div className="card rows">
          {creds.login && (
            <div className="row">
              <div className="row__text">
                <div className="mono">{t('creds.login')}</div>
                <div className="secret" style={{ marginTop: 5 }}>
                  <span className="secret__value">{creds.login}</span>
                </div>
              </div>
              <IconButton bare icon="copy" label={t('common.copy')} onClick={() => copy(creds.login, false)} />
            </div>
          )}
          {creds.password && (
            <div className="row">
              <div className="row__text">
                <div className="mono">{t('creds.password')}</div>
                <div className="secret" style={{ marginTop: 5 }}>
                  <span className="secret__value">{shown ? creds.password : '•'.repeat(Math.min(14, creds.password.length))}</span>
                </div>
              </div>
              <IconButton bare icon={shown ? 'eyeOff' : 'eye'} label={t(shown ? 'common.hide' : 'common.show')} onClick={() => setShown((s) => !s)} />
              <IconButton bare icon="copy" label={t('common.copy')} onClick={() => copy(creds.password, true)} />
            </div>
          )}
          {creds.note && (
            <div className="row">
              <div className="row__text">
                <div className="mono">{t('creds.note')}</div>
                <div style={{ marginTop: 5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{creds.note}</div>
              </div>
            </div>
          )}
          <div className="row">
            <div className="btn-row" style={{ flex: 1 }}>
              <button className="btn btn--small btn--ghost" onClick={startEdit}>
                <Icon name="edit" size={16} />
                {t('common.edit')}
              </button>
              <button className="btn btn--small btn--ghost" onClick={vault.lock}>
                <Icon name="lock" size={16} />
                {t('vault.lock')}
              </button>
            </div>
          </div>
        </div>
      )}

      <Sheet open={!!editing} title={t('creds.title')} onClose={() => setEditing(null)}>
        {editing && <CredentialsForm initial={editing} canRemove={!!sub.credentials} onSave={save} onRemove={clear} />}
      </Sheet>
    </Section>
  );
}

function CredentialsForm({ initial, canRemove, onSave, onRemove }: { initial: Credentials; canRemove: boolean; onSave: (c: Credentials) => void; onRemove: () => void }) {
  const { t } = useApp();
  const [c, setC] = useState(initial);
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ login: c.login.trim(), password: c.password, note: c.note.trim() });
      }}
    >
      <label className="field">
        <span className="field__label">{t('creds.login')}</span>
        <input className="input input--mono" value={c.login} autoCapitalize="off" autoCorrect="off" spellCheck={false} autoComplete="off" onChange={(e) => setC({ ...c, login: e.target.value })} />
      </label>
      <div className="field">
        <span className="field__label">{t('creds.password')}</span>
        <PasswordInput value={c.password} onChange={(password) => setC({ ...c, password })} />
        <button type="button" className="btn btn--small btn--ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setC({ ...c, password: generatePassword() })}>
          <Icon name="dice" size={16} />
          {t('creds.generate')}
        </button>
      </div>
      <label className="field">
        <span className="field__label">{t('creds.note')}</span>
        <textarea className="input" value={c.note} placeholder={t('creds.notePlaceholder')} onChange={(e) => setC({ ...c, note: e.target.value })} />
      </label>
      <div className="btn-row">
        {canRemove && (
          <button type="button" className="btn btn--danger" onClick={onRemove}>
            {t('common.delete')}
          </button>
        )}
        <button type="submit" className="btn">
          {t('common.save')}
        </button>
      </div>
    </form>
  );
}
