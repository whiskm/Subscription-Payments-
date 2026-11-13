import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Sheet } from '../components/Sheet';
import { PasswordInput } from '../components/ui';
import { useApp } from './app';

interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirm?: string;
  danger?: boolean;
}

interface PasswordOptions {
  title: string;
  body?: ReactNode;
  confirm?: string;
  /** Keeps the dialog open with an error until this returns true. */
  check?: (password: string) => Promise<boolean>;
}

interface DialogsValue {
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  askPassword: (o: PasswordOptions) => Promise<string | null>;
  toast: (message: string) => void;
}

type Open =
  | { kind: 'confirm'; o: ConfirmOptions; done: (v: boolean) => void }
  | { kind: 'password'; o: PasswordOptions; done: (v: string | null) => void };

const Ctx = createContext<DialogsValue | null>(null);

export function useDialogs(): DialogsValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('DialogsProvider is missing');
  return v;
}

export function DialogsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<Open | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: number; text: string }>>([]);
  const seq = useRef(0);

  const confirm = useCallback(
    (o: ConfirmOptions) => new Promise<boolean>((resolve) => setOpen({ kind: 'confirm', o, done: resolve })),
    [],
  );
  const askPassword = useCallback(
    (o: PasswordOptions) => new Promise<string | null>((resolve) => setOpen({ kind: 'password', o, done: resolve })),
    [],
  );
  const toast = useCallback((text: string) => {
    const id = ++seq.current;
    setToasts((list) => [...list.slice(-2), { id, text }]);
    window.setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 3200);
  }, []);

  const value = useMemo(() => ({ confirm, askPassword, toast }), [confirm, askPassword, toast]);

  const close = (result: boolean | string | null) => {
    if (!open) return;
    if (open.kind === 'confirm') open.done(result === true);
    else open.done(typeof result === 'string' ? result : null);
    setOpen(null);
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <Sheet open={open?.kind === 'confirm'} title={open?.kind === 'confirm' ? open.o.title : ''} onClose={() => close(false)}>
        {open?.kind === 'confirm' && <ConfirmBody o={open.o} onDone={close} />}
      </Sheet>
      <Sheet open={open?.kind === 'password'} title={open?.kind === 'password' ? open.o.title : ''} onClose={() => close(null)}>
        {open?.kind === 'password' && <PasswordBody o={open.o} onDone={close} />}
      </Sheet>
      <div className="toasts" aria-live="polite">
        <AnimatePresence>
          {toasts.map((x) => (
            <motion.div
              key={x.id}
              className="toast"
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            >
              {x.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

function ConfirmBody({ o, onDone }: { o: ConfirmOptions; onDone: (v: boolean) => void }) {
  const { t } = useApp();
  return (
    <>
      {o.body && <div className="muted">{o.body}</div>}
      <div className="btn-row">
        <button className="btn btn--ghost" onClick={() => onDone(false)}>
          {t('common.cancel')}
        </button>
        <button className={o.danger ? 'btn btn--danger' : 'btn'} onClick={() => onDone(true)}>
          {o.confirm ?? t('common.ok')}
        </button>
      </div>
    </>
  );
}

function PasswordBody({ o, onDone }: { o: PasswordOptions; onDone: (v: string | null) => void }) {
  const { t } = useApp();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(false);

  const submit = async () => {
    if (!value || busy) return;
    if (!o.check) return onDone(value);
    setBusy(true);
    const ok = await o.check(value).catch(() => false);
    setBusy(false);
    if (ok) onDone(value);
    else setWrong(true);
  };

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {o.body && <div className="muted">{o.body}</div>}
      <motion.div className="field" animate={wrong ? { x: [0, -9, 9, -6, 6, 0] } : { x: 0 }} transition={{ duration: 0.35 }}>
        <span className="field__label">{t('vault.master')}</span>
        <PasswordInput
          value={value}
          autoFocus
          autoComplete="current-password"
          onChange={(v) => {
            setValue(v);
            setWrong(false);
          }}
        />
        {wrong && <span className="field__error">{t('vault.wrong')}</span>}
      </motion.div>
      <div className="btn-row">
        <button type="button" className="btn btn--ghost" onClick={() => onDone(null)}>
          {t('common.cancel')}
        </button>
        <button type="submit" className="btn" disabled={!value || busy}>
          {busy ? t('common.wait') : (o.confirm ?? t('common.ok'))}
        </button>
      </div>
    </form>
  );
}
