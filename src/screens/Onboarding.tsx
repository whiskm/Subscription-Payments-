import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Icon } from '../components/icons';
import { Chips, Switch } from '../components/ui';
import { DEFAULT_APP_NAME } from '../i18n';
import { requestPersistence } from '../lib/db';
import { CURRENCIES, currencySymbol } from '../lib/money';
import { requestNotify } from '../lib/notify';
import { isAndroidApp, isApp, isDesktopApp, isIOS, isStandalone } from '../lib/platform';
import { LANG_CURRENCY } from '../lib/settings';
import type { Lang, ThemeMode } from '../lib/types';
import { useApp } from '../state/app';
import { go } from '../state/router';
import { LangPicker } from './Settings';

const POPULAR: Record<Lang, string[]> = {
  ru: ['RUB', 'USD', 'EUR', 'KZT', 'BYN', 'UAH', 'CNY'],
  en: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CNY', 'RUB'],
  zh: ['CNY', 'HKD', 'TWD', 'USD', 'EUR', 'JPY', 'RUB'],
};

const STEPS = 4;

/** First launch: language, money, reminders and a word about privacy. */
export function Onboarding() {
  const { settings, update, t, tn, lang } = useApp();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [name, setName] = useState('');

  const next = () => {
    setDir(1);
    setStep((s) => Math.min(STEPS - 1, s + 1));
  };
  const prev = () => {
    setDir(-1);
    setStep((s) => Math.max(0, s - 1));
  };

  const finish = async (then?: string) => {
    await requestPersistence();
    await update({ onboarded: true, appName: name.trim() || null });
    if (then) go(then);
  };

  const enableNotifications = async (on: boolean) => {
    if (!on) return update({ notifications: false });
    const state = await requestNotify();
    await update({ notifications: state === 'granted' });
  };

  const currencies = [...new Set([...POPULAR[lang], settings.currency])];

  return (
    <div className="wizard">
      <div className="wizard__progress" aria-hidden>
        {Array.from({ length: STEPS }, (_, i) => (
          <i key={i} data-on={i <= step ? '' : undefined} />
        ))}
      </div>

      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.div
          key={step}
          className="wizard__body"
          initial={{ opacity: 0, x: dir * 28 }}
          animate={{ opacity: 1, x: 0, transition: { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] } }}
          exit={{ opacity: 0, x: dir * -20, transition: { duration: 0.12 } }}
        >
          {step === 0 && (
            <>
              <div className="mono">Language · Язык · 语言</div>
              <h1 className="wizard__title">{t('onb.helloTitle')}</h1>
              <p className="wizard__lead">{t('onb.helloLead')}</p>
              <LangPicker value={lang} onChange={(l) => update({ lang: l, currency: settings.currency === LANG_CURRENCY[lang] ? LANG_CURRENCY[l] : settings.currency, weekStart: l === 'en' ? 0 : 1 })} />
            </>
          )}

          {step === 1 && (
            <>
              <div className="mono">{t('onb.step', { n: 2, total: STEPS })}</div>
              <h1 className="wizard__title">{t('onb.moneyTitle')}</h1>
              <p className="wizard__lead">{t('onb.moneyLead')}</p>
              <div className="field">
                <span className="field__label">{t('settings.currency')}</span>
                <Chips
                  label={t('settings.currency')}
                  value={settings.currency}
                  onChange={(currency) => update({ currency })}
                  options={currencies.map((c) => ({ value: c, label: `${currencySymbol(c, lang)} ${c}` }))}
                />
                <select className="input input--mono" value={settings.currency} onChange={(e) => update({ currency: e.target.value })} aria-label={t('settings.currency')}>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <label className="field">
                <span className="field__label">{t('settings.appName')}</span>
                <input className="input input--big" value={name} maxLength={40} placeholder={DEFAULT_APP_NAME[lang]} onChange={(e) => setName(e.target.value)} />
                <span className="field__hint">{t('onb.nameHint')}</span>
              </label>
              <div className="field">
                <span className="field__label">{t('settings.theme')}</span>
                <Chips<ThemeMode>
                  label={t('settings.theme')}
                  value={settings.theme}
                  onChange={(theme) => update({ theme })}
                  options={[
                    { value: 'system', label: t('settings.themeSystem') },
                    { value: 'light', label: t('settings.themeLight') },
                    { value: 'dark', label: t('settings.themeDark') },
                  ]}
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="mono">{t('onb.step', { n: 3, total: STEPS })}</div>
              <h1 className="wizard__title">{t('onb.safeTitle')}</h1>
              <p className="wizard__lead">{t('onb.safeLead')}</p>
              <div className="field">
                <span className="field__label">{t('backup.interval')}</span>
                <Chips<number>
                  label={t('backup.interval')}
                  value={settings.backup.intervalDays}
                  onChange={(intervalDays) => update({ backup: { ...settings.backup, intervalDays } })}
                  options={[
                    { value: 1, label: t('backup.daily') },
                    { value: 2, label: tn('everyDays', 2) },
                    { value: 3, label: tn('everyDays', 3) },
                    { value: 7, label: t('backup.weekly') },
                    { value: 0, label: t('backup.off') },
                  ]}
                />
                <span className="field__hint">{t(isApp ? 'backup.hintNative' : 'backup.hintWeb')}</span>
              </div>
              <div className="card rows">
                <div className="row">
                  <Icon name="bell" className="row__icon" />
                  <div className="row__text">
                    <div className="row__label">{t('settings.notifications')}</div>
                    <div className="row__hint">{t(isAndroidApp ? 'notify.hintNative' : isDesktopApp ? 'notify.hintDesktop' : 'notify.hintWeb')}</div>
                  </div>
                  <Switch label={t('settings.notifications')} checked={settings.notifications} onChange={enableNotifications} />
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="mono">{t('onb.step', { n: 4, total: STEPS })}</div>
              <h1 className="wizard__title">{t('onb.privacyTitle')}</h1>
              <div className="stack-v">
                <Point icon="device" title={t('onb.p1Title')} text={t('onb.p1')} />
                <Point icon="key" title={t('onb.p2Title')} text={t('onb.p2')} />
                <Point icon="shield" title={t('onb.p3Title')} text={t('onb.p3')} />
                {!isApp && !isStandalone() && <Point icon="download" title={t('about.install')} text={t(isIOS ? 'about.installIOS' : 'about.installOther')} />}
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="wizard__foot">
        {step > 0 && (
          <button className="btn btn--ghost" onClick={prev} aria-label={t('common.back')}>
            <Icon name="back" size={18} />
          </button>
        )}
        {step < STEPS - 1 ? (
          <button className="btn btn--block" style={{ flex: 1 }} onClick={next}>
            {t('common.next')}
          </button>
        ) : (
          <div className="stack-v stack-v--tight" style={{ flex: 1 }}>
            <button className="btn btn--accent btn--block" onClick={() => finish('/new')}>
              <Icon name="plus" size={18} />
              {t('onb.start')}
            </button>
            <button className="btn btn--ghost btn--block" onClick={() => finish('/settings/import')}>
              {t('home.haveBackup')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Point({ icon, title, text }: { icon: 'device' | 'key' | 'shield' | 'download'; title: string; text: string }) {
  return (
    <div className="note" style={{ background: 'var(--paper)', borderStyle: 'solid', borderColor: 'transparent' }}>
      <Icon name={icon} />
      <div className="note__body">
        <div className="note__title">{title}</div>
        <div className="muted">{text}</div>
      </div>
    </div>
  );
}
