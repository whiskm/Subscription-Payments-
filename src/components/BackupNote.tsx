import { useState } from 'react';
import { backupDue, manualBackup } from '../lib/autobackup';
import { useApp } from '../state/app';
import { useDialogs } from '../state/dialogs';
import { useVault } from '../state/vault';
import { Icon } from './icons';

/** Runs a backup, unlocking the vault first when the whole file is encrypted. */
export function useBackupAction(): () => Promise<void> {
  const { t } = useApp();
  const vault = useVault();
  const { toast } = useDialogs();
  return async () => {
    let outcome = await manualBackup(vault.key);
    if (outcome === 'needs-unlock') {
      const key = await vault.ensure();
      if (!key) return;
      outcome = await manualBackup(key);
    }
    if (outcome === 'cancelled' || outcome === 'needs-unlock') return;
    toast(t(outcome === 'linked' || outcome === 'saved' ? 'backup.savedToFile' : 'backup.saved'));
  };
}

export function lastBackupText(app: ReturnType<typeof useApp>): string {
  const { settings, t, tn } = app;
  if (!settings.backup.lastAt) return t('backup.never');
  const days = Math.floor((Date.now() - Date.parse(settings.backup.lastAt)) / 86_400_000);
  return days <= 0 ? t('backup.today') : tn('daysAgo', days);
}

/** The gentle "time to back up" reminder on the home screen. */
export function BackupNote() {
  const app = useApp();
  const { settings, subs, t } = app;
  const run = useBackupAction();
  const [busy, setBusy] = useState(false);
  const [snoozed, setSnoozed] = useState(false);
  if (snoozed || !subs.length || !backupDue(settings)) return null;
  return (
    <div className="note note--accent">
      <Icon name="shield" />
      <div className="note__body">
        <div className="note__title">{t('backup.dueTitle')}</div>
        <div className="muted">
          {t('backup.dueBody')} {t('backup.last')}: {lastBackupText(app)}.
        </div>
        <div className="note__actions">
          <button
            className="btn btn--small"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await run().finally(() => setBusy(false));
            }}
          >
            <Icon name="download" size={16} />
            {t('backup.saveNow')}
          </button>
          <button className="btn btn--small btn--ghost" onClick={() => setSnoozed(true)}>
            {t('common.later')}
          </button>
        </div>
      </div>
    </div>
  );
}
