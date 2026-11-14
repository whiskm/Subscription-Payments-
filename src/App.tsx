import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { Icon, type IconName } from './components/icons';
import { backupDue, silentBackup } from './lib/autobackup';
import { requestPersistence } from './lib/db';
import { setKeepInTray, setTrayLabels, setWindowTitle } from './lib/desktop';
import { notifyDue, syncNotifications } from './lib/notify';
import { isAndroidApp, isDesktopApp } from './lib/platform';
import { refreshRates } from './lib/rates';
import { rollAll } from './lib/store';
import { Calendar } from './screens/Calendar';
import { Detail } from './screens/Detail';
import { Edit } from './screens/Edit';
import { Home } from './screens/Home';
import { List } from './screens/List';
import { Lock } from './screens/Lock';
import { Onboarding } from './screens/Onboarding';
import { Stats } from './screens/Stats';
import { Settings } from './screens/Settings';
import { Categories, Import, Rates } from './screens/SettingsPages';
import { useApp } from './state/app';
import { back, go, scrollTarget, usePath } from './state/router';
import { useVault } from './state/vault';
import type { Key } from './i18n';

const NAV: Array<{ path: string; icon: IconName; label: Key }> = [
  { path: '/', icon: 'ticket', label: 'nav.home' },
  { path: '/list', icon: 'list', label: 'nav.list' },
  { path: '/calendar', icon: 'calendar', label: 'nav.calendar' },
  { path: '/stats', icon: 'chart', label: 'nav.stats' },
];

function route(path: string) {
  const [, a, b, c] = path.split('/');
  if (!a) return { key: 'home', tab: true, el: <Home /> };
  if (a === 'list') return { key: 'list', tab: true, el: <List /> };
  if (a === 'calendar') return { key: 'calendar', tab: true, el: <Calendar /> };
  if (a === 'stats') return { key: 'stats', tab: true, el: <Stats /> };
  if (a === 'new') return { key: `new/${b ?? ''}`, tab: false, el: <Edit serviceKey={b} /> };
  if (a === 'sub' && b && c === 'edit') return { key: `edit/${b}`, tab: false, el: <Edit id={b} /> };
  if (a === 'sub' && b) return { key: `sub/${b}`, tab: false, el: <Detail id={b} /> };
  if (a === 'settings' && b === 'rates') return { key: 'rates', tab: false, el: <Rates /> };
  if (a === 'settings' && b === 'categories') return { key: 'categories', tab: false, el: <Categories /> };
  if (a === 'settings' && b === 'import') return { key: 'import', tab: false, el: <Import /> };
  if (a === 'settings') return { key: 'settings', tab: true, el: <Settings /> };
  return { key: 'home', tab: true, el: <Home /> };
}


/** Background chores: renew passed dates, rates, reminders, automatic backups. */
function useHousekeeping() {
  const { settings, subs, today } = useApp();
  const vault = useVault();
  const backupRunning = useRef(false);

  useEffect(() => {
    void rollAll(today);
  }, [today]);

  useEffect(() => {
    void requestPersistence();
  }, []);

  // Rates are fetched only when some subscription is actually in another currency,
  // so with a single currency the app never goes online at all.
  const foreign = subs.some((s) => s.currency !== settings.currency);
  useEffect(() => {
    if (settings.ratesAuto && foreign) void refreshRates().catch(() => undefined);
  }, [settings.ratesAuto, settings.currency, foreign, today]);

  // Reschedule reminders whenever anything they depend on changes.
  useEffect(() => {
    const timer = window.setTimeout(() => void syncNotifications(subs, settings), 800);
    return () => window.clearTimeout(timer);
  }, [subs, settings]);

  // Once a day on the website (when opened). The desktop app checks every few
  // minutes while it runs, including from the tray, so it fires at the chosen time.
  const latest = useRef({ subs, settings });
  latest.current = { subs, settings };
  useEffect(() => {
    void notifyDue(subs, settings, today);
    if (!isDesktopApp) return;
    const timer = window.setInterval(() => void notifyDue(latest.current.subs, latest.current.settings), 5 * 60_000);
    return () => window.clearInterval(timer);
  }, [today, settings.notifications, settings.notifyTime]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!backupDue(settings, subs) || backupRunning.current) return;
    backupRunning.current = true;
    void silentBackup(vault.key).finally(() => (backupRunning.current = false));
  }, [today, subs.length, settings.backup.intervalDays, settings.backup.lastAt, vault.key]); // eslint-disable-line react-hooks/exhaustive-deps
}

function useAndroidBack(path: string) {
  const pathRef = useRef(path);
  pathRef.current = path;
  useEffect(() => {
    if (!isAndroidApp) return;
    let remove: (() => void) | undefined;
    void import('@capacitor/app').then(({ App }) =>
      App.addListener('backButton', () => {
        // Sheets close themselves on Escape; let them handle the button first.
        if (document.querySelector('.sheet')) {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
          return;
        }
        if (pathRef.current === '/') void App.minimizeApp();
        else back('/');
      }).then((h) => (remove = () => void h.remove())),
    );
    return () => remove?.();
  }, []);
}

export function App() {
  const { settings, t, appName } = useApp();
  const vault = useVault();
  const path = usePath();
  const [unlockedOnce, setUnlockedOnce] = useState(false);

  useEffect(() => {
    if (vault.unlocked) setUnlockedOnce(true);
  }, [vault.unlocked]);

  useEffect(() => {
    document.title = appName;
    void setWindowTitle(appName);
  }, [appName]);

  // Desktop shell: tray menu in the chosen language, and what closing the window does.
  useEffect(() => {
    void setTrayLabels(t('tray.open'), t('tray.quit'));
  }, [t]);
  useEffect(() => {
    void setKeepInTray(settings.trayOnClose);
  }, [settings.trayOnClose]);

  useHousekeeping();
  useAndroidBack(path);

  if (!settings.onboarded) return <Onboarding />;
  if (settings.lockOnLaunch && !unlockedOnce) {
    // Render nothing until we know whether a vault exists, so data never flashes before the lock.
    if (!vault.ready) return null;
    if (vault.exists && !vault.unlocked) return <Lock />;
  }

  const r = route(path);
  const active = NAV.find((n) => (n.path === '/' ? path === '/' : path.startsWith(n.path)))?.path;

  return (
    <div className="shell shell--nav">
      <nav className="rail" aria-label={appName}>
        <div className="rail__name">{appName}</div>
        <button className="btn btn--accent rail__add" onClick={() => go('/new')}>
          <Icon name="plus" size={18} />
          {t('common.add')}
        </button>
        {NAV.map((n) => (
          <button key={n.path} className="rail__item" aria-current={active === n.path ? 'page' : undefined} onClick={() => go(n.path)}>
            <Icon name={n.icon} />
            {t(n.label)}
          </button>
        ))}
        <div className="rail__spacer" />
        <button className="rail__item" aria-current={path.startsWith('/settings') ? 'page' : undefined} onClick={() => go('/settings')}>
          <Icon name="sliders" />
          {t('nav.settings')}
        </button>
      </nav>

      <main>
        <AnimatePresence mode="wait" initial={false} onExitComplete={() => requestAnimationFrame(() => window.scrollTo(0, scrollTarget()))}>
          <motion.div
            key={r.key}
            initial={{ opacity: 0, y: r.tab ? 6 : 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: r.tab ? -4 : 10 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {r.el}
          </motion.div>
        </AnimatePresence>
      </main>

      {r.tab && (
        <nav className="tabbar" aria-label={appName}>
          <LayoutGroup>
            {NAV.slice(0, 2).map((n) => (
              <TabItem key={n.path} {...n} active={active === n.path} label={t(n.label)} />
            ))}
            <button className="tabbar__add" onClick={() => go('/new')} aria-label={t('common.add')}>
              <Icon name="plus" size={24} />
            </button>
            {NAV.slice(2).map((n) => (
              <TabItem key={n.path} {...n} active={active === n.path} label={t(n.label)} />
            ))}
          </LayoutGroup>
        </nav>
      )}
    </div>
  );
}

function TabItem({ path, icon, label, active }: { path: string; icon: IconName; label: string; active: boolean }) {
  return (
    <button className="tabbar__item" aria-current={active ? 'page' : undefined} aria-label={label} title={label} onClick={() => go(path)}>
      {active && <motion.span layoutId="tab-pill" className="tabbar__pill" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
      <Icon name={icon} />
    </button>
  );
}
