import { useEffect, useState, type CSSProperties } from 'react';
import { Icon } from '../components/icons';
import { lastBackupText, useBackupAction } from '../components/BackupNote';
import { Sheet } from '../components/Sheet';
import { TopBar, BackBar } from '../components/TopBar';
import { Chips, MultiChips, Row, Section, Segmented, Switch } from '../components/ui';
import { DEFAULT_APP_NAME, LANG_NAMES } from '../i18n';
import { linkFile, linkedFileName, unlinkFile } from '../lib/autobackup';
import { collectBackup, serializeEncrypted, serializePlain, backupFileName } from '../lib/backup';
import { kvGet, requestPersistence } from '../lib/db';
import { toCSV, toICS } from '../lib/exporters';
import { saveFile } from '../lib/files';
import { formatDate, weekdayNames } from '../lib/format';
import { CURRENCIES, formatMoney } from '../lib/money';
import { notifyState, requestNotify, type NotifyState } from '../lib/notify';
import { autostartEnabled, openBackupFolder, openExternal, setAutostart } from '../lib/desktop';
import { canLinkFile, isAndroidApp, isApp, isDesktopApp, isIOS, isStandalone } from '../lib/platform';
import { ownShare } from '../lib/schedule';
import { eraseEverything } from '../lib/store';
import type { AccentKey, DateFormat, Lang, Settings as SettingsT, ThemeMode, VaultMeta } from '../lib/types';
import { useApp } from '../state/app';
import { useDialogs } from '../state/dialogs';
import { go } from '../state/router';
import { useVault } from '../state/vault';

const ACCENTS: Record<AccentKey, string> = {
  vermilion: '#E4572E',
  cobalt: '#2B59E8',
  emerald: '#14805A',
  violet: '#7244DE',
  amber: '#E59A0C',
  rose: '#D9336C',
  ink: '#1B1915',
};

const REPO_URL = 'https://github.com/whiskm/Subscription-Payments-';

export function Settings() {
  const app = useApp();
  const { settings, update, t, tn, lang, appName, subs } = app;
  const vault = useVault();
  const { toast, confirm } = useDialogs();
  const backupNow = useBackupAction();
  const [sheet, setSheet] = useState<null | 'name' | 'lang' | 'export'>(null);
  const [notify, setNotify] = useState<NotifyState>('unsupported');
  const [linked, setLinked] = useState<string | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [autostart, setAutostartState] = useState(false);

  useEffect(() => {
    void notifyState().then(setNotify);
    if (isDesktopApp) void autostartEnabled().then(setAutostartState).catch(() => undefined);
    void linkedFileName().then(setLinked);
    void navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  const toggleNotifications = async (on: boolean) => {
    if (!on) return update({ notifications: false });
    let state = await notifyState();
    if (state === 'prompt') state = await requestNotify();
    setNotify(state);
    if (state === 'granted') await update({ notifications: true });
    else toast(t(state === 'unsupported' ? 'notify.unsupported' : 'notify.denied'));
  };

  const toggleEncrypt = async (on: boolean) => {
    if (on && !(await vault.setup())) return;
    await update({ backup: { ...settings.backup, encrypt: on } });
  };

  const erase = async () => {
    const ok = await confirm({ title: t('data.eraseTitle'), body: t('data.eraseBody'), confirm: t('data.eraseConfirm'), danger: true });
    if (!ok) return;
    await eraseEverything();
    window.location.replace(window.location.pathname);
  };

  const weekdays = weekdayNames(lang, 0).map((d) => d.charAt(0).toUpperCase() + d.slice(1));
  const remindOptions = [0, 1, 2, 3, 5, 7, 14].map((d) => ({ value: d, label: d === 0 ? t('remind.sameDay') : tn('daysBefore', d) }));

  return (
    <div className="screen">
      <TopBar title={t('nav.settings')} kicker={appName} />

      <Section title={t('settings.general')}>
        <div className="card rows">
          <Row icon="tag" label={t('settings.appName')} value={appName} onClick={() => setSheet('name')} />
          <Row icon="globe" label={t('settings.language')} value={LANG_NAMES[lang]} onClick={() => setSheet('lang')} />
          <Row icon="coins" label={t('settings.currency')}>
            <select className="input input--mono" style={{ width: 96, height: 36 }} value={settings.currency} onChange={(e) => update({ currency: e.target.value })} aria-label={t('settings.currency')}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Row>
          <Row icon="refresh" label={t('settings.rates')} hint={t('settings.ratesHint')} onClick={() => go('/settings/rates')} />
          <div className="row row--stack">
            <div className="row__label">{t('settings.dateFormat')}</div>
            <Chips<DateFormat>
              label={t('settings.dateFormat')}
              value={settings.dateFormat}
              onChange={(dateFormat) => update({ dateFormat })}
              options={(['auto', 'dmy', 'mdy', 'ymd'] as DateFormat[]).map((f) => ({ value: f, label: formatDate('2026-03-28', lang, f, { year: true }) }))}
            />
          </div>
          <div className="row row--stack">
            <div className="row__label">{t('settings.weekStart')}</div>
            <Segmented<0 | 1 | 6>
              label={t('settings.weekStart')}
              value={settings.weekStart}
              onChange={(weekStart) => update({ weekStart })}
              options={([1, 0, 6] as const).map((d) => ({ value: d, label: weekdays[d] }))}
            />
          </div>
        </div>
      </Section>

      <Section title={t('settings.appearance')}>
        <div className="card rows">
          <div className="row row--stack">
            <div className="row__label">{t('settings.theme')}</div>
            <Segmented<ThemeMode>
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
          <div className="row row--stack">
            <div className="row__label">{t('settings.accent')}</div>
            <div className="swatches" role="radiogroup" aria-label={t('settings.accent')}>
              {(Object.keys(ACCENTS) as AccentKey[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={settings.accent === k}
                  aria-label={k}
                  className="swatch"
                  style={{ '--c': ACCENTS[k] } as CSSProperties}
                  onClick={() => update({ accent: k })}
                />
              ))}
            </div>
          </div>
          <div className="row row--stack">
            <div className="row__label">{t('settings.density')}</div>
            <Segmented<SettingsT['density']>
              label={t('settings.density')}
              value={settings.density}
              onChange={(density) => update({ density })}
              options={[
                { value: 'cozy', label: t('settings.cozy') },
                { value: 'compact', label: t('settings.compact') },
              ]}
            />
          </div>
          <Row icon="eyeOff" label={t('settings.hideAmounts')} hint={t('settings.hideAmountsHint')}>
            <Switch label={t('settings.hideAmounts')} checked={settings.hideAmounts} onChange={(hideAmounts) => update({ hideAmounts })} />
          </Row>
          <div className="row row--stack">
            <div className="row__label">{t('settings.horizon')}</div>
            <Chips<number>
              label={t('settings.horizon')}
              value={settings.horizonDays}
              onChange={(horizonDays) => update({ horizonDays })}
              options={[7, 14, 30, 60].map((d) => ({ value: d, label: tn('days', d) }))}
            />
          </div>
          <Row icon="tag" label={t('settings.categories')} onClick={() => go('/settings/categories')} />
        </div>
      </Section>

      <Section title={t('settings.reminders')}>
        <div className="card rows">
          <Row icon="bell" label={t('settings.notifications')} hint={t(isAndroidApp ? 'notify.hintNative' : isDesktopApp ? 'notify.hintDesktop' : notify === 'unsupported' ? 'notify.hintUnsupported' : 'notify.hintWeb')}>
            <Switch label={t('settings.notifications')} checked={settings.notifications && notify === 'granted'} onChange={toggleNotifications} />
          </Row>
          <div className="row row--stack">
            <div className="row__label">{t('settings.remindWhen')}</div>
            <MultiChips<number>
              label={t('settings.remindWhen')}
              values={settings.remindDays}
              onToggle={(d) => {
                const next = settings.remindDays.includes(d) ? settings.remindDays.filter((x) => x !== d) : [...settings.remindDays, d].sort((a, b) => b - a);
                if (next.length) void update({ remindDays: next });
              }}
              options={remindOptions}
            />
          </div>
          {isApp && (
            <Row icon="clock" label={t('settings.notifyTime')}>
              <input className="input input--mono" type="time" style={{ width: 110, height: 36 }} value={settings.notifyTime} onChange={(e) => e.target.value && update({ notifyTime: e.target.value })} />
            </Row>
          )}
          <Row
            icon="calendar"
            label={t('settings.toCalendar')}
            hint={t('settings.toCalendarHint')}
            onClick={async () => {
              const ics = toICS(subs, settings, {
                calendarName: appName,
                summary: (s) => `${s.name} · ${formatMoney(ownShare(s), s.currency, lang)}`,
                description: (s) => `${app.cycleLabel(s.cycle)}${s.url ? `\n${s.url}` : ''}`,
              });
              await saveFile('subscriptions.ics', ics, 'text/calendar');
            }}
          />
        </div>
      </Section>

      <Section title={t('settings.backup')}>
        <div className="card rows">
          <div className="row row--stack">
            <div className="row__text">
              <div className="row__label">{t('backup.interval')}</div>
              <div className="row__hint">{t(isApp ? 'backup.hintNative' : canLinkFile ? 'backup.hintDesktop' : 'backup.hintWeb')}</div>
            </div>
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
          </div>
          <Row icon="lock" label={t('backup.encrypt')} hint={t('backup.encryptHint')}>
            <Switch label={t('backup.encrypt')} checked={settings.backup.encrypt && vault.exists} onChange={toggleEncrypt} />
          </Row>
          {canLinkFile && (
            <Row
              icon="file"
              label={linked ? t('backup.linked', { name: linked }) : t('backup.link')}
              hint={t('backup.linkHint')}
              onClick={async () => {
                if (linked) {
                  await unlinkFile();
                  setLinked(null);
                } else {
                  const name = await linkFile();
                  if (name) {
                    setLinked(name);
                    await backupNow();
                  }
                }
              }}
            />
          )}
          {isApp && (
            <Row icon="file" label={t('backup.keep')}>
              <Segmented<number>
                label={t('backup.keep')}
                value={settings.backup.keep}
                onChange={(keep) => update({ backup: { ...settings.backup, keep } })}
                options={[3, 5, 10].map((n) => ({ value: n, label: String(n) }))}
              />
            </Row>
          )}
          <Row icon="download" label={t('backup.saveNow')} value={lastBackupText(app)} onClick={backupNow} />
        </div>
      </Section>

      <Section title={t('settings.data')}>
        <div className="card rows">
          <Row icon="upload" label={t('data.import')} hint={t('data.importHint')} onClick={() => go('/settings/import')} />
          <Row icon="download" label={t('data.export')} hint={t('data.exportHint')} onClick={() => setSheet('export')} />
          {isDesktopApp && <Row icon="file" label={t('backup.openFolder')} hint={t('backup.folderHint')} onClick={() => void openBackupFolder().catch(() => toast(t('backup.folderFailed')))} />}
          {!isApp && (
            <Row
              icon="shield"
              label={t('data.persist')}
              hint={t(persisted ? 'data.persistOn' : isIOS && !isStandalone() ? 'data.persistIOS' : 'data.persistOff')}
              value={persisted ? '✓' : undefined}
              onClick={
                persisted
                  ? undefined
                  : async () => {
                      const ok = await requestPersistence();
                      setPersisted(ok);
                      toast(t(ok ? 'data.persistOn' : 'data.persistDenied'));
                    }
              }
            />
          )}
        </div>
      </Section>

      {isDesktopApp && (
        <Section title={t('settings.desktop')}>
          <div className="card rows">
            <Row icon="device" label={t('desktop.tray')} hint={t('desktop.trayHint')}>
              <Switch label={t('desktop.tray')} checked={settings.trayOnClose} onChange={(trayOnClose) => update({ trayOnClose })} />
            </Row>
            <Row icon="clock" label={t('desktop.autostart')} hint={t('desktop.autostartHint')}>
              <Switch
                label={t('desktop.autostart')}
                checked={autostart}
                onChange={async (on) => {
                  try {
                    await setAutostart(on);
                    setAutostartState(on);
                    // Starting at login only helps reminders if closing keeps the app in the tray.
                    if (on && !settings.trayOnClose) await update({ trayOnClose: true });
                  } catch {
                    toast(t('desktop.autostartFailed'));
                  }
                }}
              />
            </Row>
          </div>
        </Section>
      )}

      <Section title={t('settings.security')}>
        <div className="card rows">
          {!vault.exists ? (
            <Row icon="key" label={t('vault.create')} hint={t('vault.createHint')} onClick={() => void vault.setup()} />
          ) : (
            <>
              <Row icon={vault.unlocked ? 'unlock' : 'lock'} label={t('vault.status')} value={t(vault.unlocked ? 'vault.isOpen' : 'vault.isLocked')} onClick={vault.unlocked ? vault.lock : () => void vault.ensure()} />
              <Row icon="key" label={t('vault.change')} onClick={async () => (await vault.change()) && toast(t('vault.changed'))} />
              <Row icon="lock" label={t('security.lockOnLaunch')} hint={t('security.lockOnLaunchHint')}>
                <Switch label={t('security.lockOnLaunch')} checked={settings.lockOnLaunch} onChange={(lockOnLaunch) => update({ lockOnLaunch })} />
              </Row>
              <div className="row row--stack">
                <div className="row__label">{t('security.autoLock')}</div>
                <Chips<number>
                  label={t('security.autoLock')}
                  value={settings.autoLockMin}
                  onChange={(autoLockMin) => update({ autoLockMin })}
                  options={[
                    { value: 1, label: tn('minutes', 1) },
                    { value: 5, label: tn('minutes', 5) },
                    { value: 15, label: tn('minutes', 15) },
                    { value: 0, label: t('security.onClose') },
                  ]}
                />
              </div>
              <Row icon="trash" danger label={t('vault.remove')} onClick={async () => (await vault.destroy()) && update({ lockOnLaunch: false, backup: { ...settings.backup, encrypt: false } })} />
            </>
          )}
        </div>
      </Section>

      <Section title={t('settings.about')}>
        <div className="card rows">
          <div className="row">
            <Icon name="shield" className="row__icon" />
            <div className="row__text">
              <div className="row__label">{t('about.privacyTitle')}</div>
              <div className="row__hint">{t('about.privacy')}</div>
            </div>
          </div>
          {!isApp && !isStandalone() && <Row icon="device" label={t('about.install')} hint={t(isIOS ? 'about.installIOS' : 'about.installOther')} />}
          <Row icon="external" label="GitHub" value={`v${__APP_VERSION__}`} onClick={() => void openExternal(REPO_URL)} />
          <Row icon="trash" danger label={t('data.erase')} hint={t('data.eraseHint')} onClick={erase} />
        </div>
      </Section>

      <Sheet open={sheet === 'name'} title={t('settings.appName')} onClose={() => setSheet(null)}>
        {sheet === 'name' && <NameForm onDone={() => setSheet(null)} />}
      </Sheet>
      <Sheet open={sheet === 'lang'} title={t('settings.language')} onClose={() => setSheet(null)}>
        <LangPicker
          value={lang}
          onChange={async (l) => {
            await update({ lang: l });
            setSheet(null);
          }}
        />
      </Sheet>
      <Sheet open={sheet === 'export'} title={t('data.export')} onClose={() => setSheet(null)}>
        {sheet === 'export' && <ExportOptions onDone={() => setSheet(null)} />}
      </Sheet>
    </div>
  );
}

export function LangPicker({ value, onChange }: { value: Lang; onChange: (l: Lang) => void }) {
  return (
    <div className="stack-v stack-v--tight" role="radiogroup">
      {(['ru', 'en', 'zh'] as Lang[]).map((l) => (
        <button key={l} type="button" role="radio" aria-checked={value === l} className="choice" onClick={() => onChange(l)}>
          <span className="choice__code">{l.toUpperCase()}</span>
          <span>{LANG_NAMES[l]}</span>
          <Icon name="check" className="choice__check" />
        </button>
      ))}
    </div>
  );
}

function NameForm({ onDone }: { onDone: () => void }) {
  const { settings, update, t, lang } = useApp();
  const [name, setName] = useState(settings.appName ?? '');
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        await update({ appName: name.trim() || null });
        onDone();
      }}
    >
      <label className="field">
        <span className="field__label">{t('settings.appName')}</span>
        <input className="input input--big" value={name} maxLength={40} autoFocus placeholder={DEFAULT_APP_NAME[lang]} onChange={(e) => setName(e.target.value)} />
        <span className="field__hint">{t('settings.appNameHint')}</span>
      </label>
      <div className="chips">
        {['SP', DEFAULT_APP_NAME[lang], '💳'].map((n) => (
          <button type="button" key={n} className="chip" onClick={() => setName(n)}>
            {n}
          </button>
        ))}
      </div>
      <div className="btn-row">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={async () => {
            await update({ appName: null });
            onDone();
          }}
        >
          {t('settings.appNameReset')}
        </button>
        <button type="submit" className="btn">
          {t('common.save')}
        </button>
      </div>
    </form>
  );
}

function ExportOptions({ onDone }: { onDone: () => void }) {
  const app = useApp();
  const { t, subs, categories, categoryName, cycleLabel } = app;
  const vault = useVault();
  const { toast } = useDialogs();

  const done = (outcome: string) => {
    if (outcome !== 'cancelled') toast(t('data.exported'));
    onDone();
  };

  return (
    <div className="card rows" style={{ boxShadow: 'inset 0 0 0 1.5px var(--line)' }}>
      <Row
        icon="file"
        label={t('data.exportJson')}
        hint={t('data.exportJsonHint')}
        onClick={async () => done(await saveFile(backupFileName(), serializePlain(await collectBackup()), 'application/json'))}
      />
      <Row
        icon="lock"
        label={t('data.exportEncrypted')}
        hint={t('data.exportEncryptedHint')}
        onClick={async () => {
          const key = vault.exists ? await vault.ensure() : await vault.setup();
          const meta = await kvGet<VaultMeta>('vault');
          if (!key || !meta) return;
          done(await saveFile(backupFileName(new Date(), true), await serializeEncrypted(await collectBackup(), meta, key), 'application/json'));
        }}
      />
      <Row
        icon="list"
        label={t('data.exportCsv')}
        hint={t('data.exportCsvHint')}
        onClick={async () => {
          const csv = toCSV(subs, categories, {
            headers: [t('csv.name'), t('edit.category'), t('edit.price'), t('edit.currency'), t('edit.cycle'), t('edit.nextDate'), t('edit.status'), t('edit.share'), t('edit.payment'), t('edit.url'), t('edit.notes')],
            category: (c) => (c ? categoryName(c) : ''),
            cycle: (s) => cycleLabel(s.cycle),
            status: (s) => t(`status.${s.status}`),
          });
          done(await saveFile('subscriptions.csv', csv, 'text/csv'));
        }}
      />
    </div>
  );
}

export function SettingsBack({ title }: { title: string }) {
  return <BackBar title={title} fallback="/settings" />;
}
