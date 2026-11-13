import { useState, type CSSProperties } from 'react';
import { motion } from 'motion/react';
import { Icon } from '../components/icons';
import { PasswordInput } from '../components/ui';
import { useApp } from '../state/app';
import { useVault } from '../state/vault';

/** Shown on launch when "lock the app" is on. */
export function Lock() {
  const { t, appName } = useApp();
  const vault = useVault();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(0);

  return (
    <div className="lock">
      <motion.form
        className="card lock__card"
        initial={{ opacity: 0, y: 24, rotate: -1 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!value || busy) return;
          setBusy(true);
          const ok = await vault.unlock(value);
          setBusy(false);
          if (!ok) {
            setWrong((n) => n + 1);
            setValue('');
          }
        }}
      >
        <span className="mark" style={{ '--brand': 'var(--ink)', '--size': '52px', color: 'var(--desk)' } as CSSProperties}>
          <Icon name="lock" size={26} />
        </span>
        <div>
          <div className="mono">{appName}</div>
          <h1 className="wizard__title" style={{ marginTop: 6 }}>
            {t('lock.title')}
          </h1>
        </div>
        <motion.label key={wrong} className="field" animate={wrong ? { x: [0, -10, 10, -6, 6, 0] } : undefined} transition={{ duration: 0.35 }}>
          <span className="field__label">{t('vault.master')}</span>
          <PasswordInput value={value} onChange={setValue} autoFocus autoComplete="current-password" />
          {wrong > 0 && <span className="field__error">{t('vault.wrong')}</span>}
        </motion.label>
        <button className="btn btn--block" type="submit" disabled={!value || busy}>
          {busy ? t('common.wait') : t('vault.unlock')}
        </button>
      </motion.form>
    </div>
  );
}
