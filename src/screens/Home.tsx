import { useMemo } from 'react';
import { motion } from 'motion/react';
import { BackupNote } from '../components/BackupNote';
import { Icon } from '../components/icons';
import { ServiceMark, Stamp, TicketList } from '../components/Ticket';
import { TopBar } from '../components/TopBar';
import { IconButton, Leader, Section } from '../components/ui';
import { getService, serviceName, STARTERS } from '../data/catalog';
import { monthTitle, weekdayLong } from '../lib/format';
import { isCounted } from '../lib/schedule';
import { monthFlow, totals, upcoming } from '../lib/stats';
import { useApp } from '../state/app';
import { go } from '../state/router';

export function Home() {
  const app = useApp();
  const { subs, settings, today, t, tn, money, date, appName, lang, update } = app;

  const flow = useMemo(() => monthFlow(subs, settings, today), [subs, settings, today]);
  const sum = useMemo(() => totals(subs, settings), [subs, settings]);
  const next = useMemo(() => upcoming(subs, today, settings.horizonDays), [subs, today, settings.horizonDays]);
  const overdue = next.filter((u) => u.days < 0 && isCounted(u.sub));
  const soon = next.filter((u) => !(u.days < 0 && isCounted(u.sub)));
  const paidShare = flow.total > 0 ? flow.paid / flow.total : 0;

  return (
    <div className="screen">
      <TopBar
        kicker={`${weekdayLong(today, lang)} · ${date(today, { year: true })}`}
        title={appName}
        actions={
          <>
            <IconButton
              icon={settings.hideAmounts ? 'eyeOff' : 'eye'}
              label={t(settings.hideAmounts ? 'home.showAmounts' : 'home.hideAmounts')}
              onClick={() => update({ hideAmounts: !settings.hideAmounts })}
            />
            <span className="only-mobile">
              <IconButton icon="sliders" label={t('nav.settings')} onClick={() => go('/settings')} />
            </span>
          </>
        }
      />

      {subs.length === 0 ? (
        <Welcome />
      ) : (
        <>
          <motion.div className="receipt" initial={{ opacity: 0, y: 18, rotate: -0.6 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
            <div className="receipt__paper">
              <div className="receipt__head mono">
                <span>{monthTitle(today, lang)}</span>
                <span>{tn('subscriptions', sum.count)}</span>
              </div>
              <div className="receipt__total">{money(flow.total, undefined, { round: true })}</div>
              <div className="receipt__sub mono">{t('home.thisMonth')}</div>
              {flow.total > 0 && flow.upcoming === 0 && (
                <div className="receipt__stamp">
                  <Stamp tone="good" big>
                    {t('home.allPaid')}
                  </Stamp>
                </div>
              )}
              <div className="meter" aria-hidden>
                <i style={{ width: `${Math.round(paidShare * 100)}%` }} />
              </div>
              <div className="receipt__rows" style={{ borderTop: 0, paddingTop: 12 }}>
                <Leader label={t('home.paid')} value={money(flow.paid, undefined, { round: true })} />
                <Leader label={t('home.toPay')} value={money(flow.upcoming, undefined, { round: true })} strong />
              </div>
              <div className="receipt__rows">
                <Leader label={t('home.perMonth')} value={money(sum.monthly, undefined, { round: true })} />
                <Leader label={t('home.perYear')} value={money(sum.yearly, undefined, { round: true })} />
              </div>
            </div>
          </motion.div>

          {sum.missing.length > 0 && (
            <div className="note">
              <Icon name="coins" />
              <div className="note__body">
                <div className="note__title">{t('home.noRateTitle', { list: sum.missing.join(', ') })}</div>
                <div className="muted">{t('home.noRateBody')}</div>
                <div className="note__actions">
                  <button className="btn btn--small btn--ghost" onClick={() => go('/settings/rates')}>
                    {t('settings.rates')}
                  </button>
                </div>
              </div>
            </div>
          )}

          <BackupNote />

          {overdue.length > 0 && (
            <Section title={t('home.overdue')} aside={String(overdue.length)}>
              <TicketList subs={overdue.map((u) => u.sub)} onOpen={(s) => go(`/sub/${s.id}`)} />
            </Section>
          )}

          <Section title={t('home.upNext')} aside={tn('nextDays', settings.horizonDays)}>
            {soon.length ? (
              <TicketList subs={soon.map((u) => u.sub)} onOpen={(s) => go(`/sub/${s.id}`)} />
            ) : (
              <div className="note">
                <Icon name="check" />
                <div className="note__body">{tn('nothingSoon', settings.horizonDays)}</div>
              </div>
            )}
          </Section>

          <button className="btn btn--ghost btn--block" onClick={() => go('/list')}>
            {t('home.all')} · {subs.length}
          </button>
        </>
      )}
    </div>
  );
}

function Welcome() {
  const { t, lang } = useApp();
  const starters = STARTERS[lang].map(getService).filter((s) => !!s);
  return (
    <div className="empty">
      <motion.div className="ghost-ticket" initial={{ opacity: 0, rotate: -4, y: 20 }} animate={{ opacity: 1, rotate: -1.5, y: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 18 }}>
        <div>
          <i style={{ width: '62%' }} />
          <i style={{ width: '40%' }} />
        </div>
        <div>?</div>
      </motion.div>
      <h2 className="empty__title">{t('home.emptyTitle')}</h2>
      <p className="empty__text">{t('home.emptyText')}</p>
      <button className="btn btn--accent" onClick={() => go('/new')}>
        <Icon name="plus" size={18} />
        {t('home.addFirst')}
      </button>
      <div className="mono" style={{ marginTop: 14 }}>
        {t('home.quickPick')}
      </div>
      <div className="chips" style={{ justifyContent: 'center' }}>
        {starters.map((s) => (
          <button key={s.key} className="chip" style={{ paddingLeft: 5 }} onClick={() => go(`/new/${s.key}`)}>
            <ServiceMark name={serviceName(s, lang)} color={s.color} service={s.key} size={26} />
            {serviceName(s, lang)}
          </button>
        ))}
      </div>
      <button className="link" style={{ marginTop: 10 }} onClick={() => go('/settings/import')}>
        {t('home.haveBackup')}
      </button>
    </div>
  );
}
