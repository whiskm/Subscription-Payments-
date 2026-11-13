import { useMemo, useState, type CSSProperties } from 'react';
import { motion } from 'motion/react';
import { Icon } from '../components/icons';
import { ServiceMark } from '../components/Ticket';
import { TopBar } from '../components/TopBar';
import { Leader, Section } from '../components/ui';
import { monthShort, monthTitle } from '../lib/format';
import { toBase } from '../lib/money';
import { isCounted, monthlyCost } from '../lib/schedule';
import { byCategory, forecast, totals } from '../lib/stats';
import { useApp } from '../state/app';
import { go } from '../state/router';

export function Stats() {
  const { subs, settings, today, t, tn, money, lang, category, categoryName } = useApp();
  const sum = useMemo(() => totals(subs, settings), [subs, settings]);
  const cats = useMemo(() => byCategory(subs, settings), [subs, settings]);
  const months = useMemo(() => forecast(subs, settings, today, 12), [subs, settings, today]);
  const [picked, setPicked] = useState(0);

  const ranked = useMemo(
    () =>
      subs
        .filter(isCounted)
        .map((s) => ({ s, v: toBase(monthlyCost(s), s.currency, settings.currency, settings.rates) ?? 0 }))
        .sort((a, b) => b.v - a.v)
        .slice(0, 6),
    [subs, settings],
  );

  const yearAhead = months.reduce((a, b) => a + b.total, 0);
  const peak = Math.max(1, ...months.map((m) => m.total));
  const top = ranked[0]?.v || 1;
  const shared = subs.filter((s) => isCounted(s) && s.share > 1);
  const saved = shared.reduce((acc, s) => acc + (toBase(monthlyCost(s) * (s.share - 1), s.currency, settings.currency, settings.rates) ?? 0), 0);
  const paused = subs.filter((s) => s.status === 'paused' || s.status === 'cancelled');

  if (!sum.count) {
    return (
      <div className="screen">
        <TopBar title={t('nav.stats')} />
        <div className="empty">
          <h2 className="empty__title">{t('stats.emptyTitle')}</h2>
          <p className="empty__text">{t('stats.emptyText')}</p>
        </div>
      </div>
    );
  }

  const pickedMonth = months[picked];

  return (
    <div className="screen">
      <TopBar kicker={tn('subscriptions', sum.count)} title={t('nav.stats')} />

      <div className="tiles">
        <div className="card tile">
          <div className="mono">{t('stats.month')}</div>
          <div className="tile__value">{money(sum.monthly, undefined, { round: true })}</div>
        </div>
        <div className="card tile">
          <div className="mono">{t('stats.year')}</div>
          <div className="tile__value">{money(sum.yearly, undefined, { round: true })}</div>
        </div>
        <div className="card tile">
          <div className="mono">{t('stats.day')}</div>
          <div className="tile__value">{money(sum.monthly / 30.44)}</div>
        </div>
      </div>

      <Section title={t('stats.byCategory')}>
        <div className="card card--pad">
          <div className="stack" aria-hidden>
            {cats.map((c, i) => (
              <motion.i
                key={c.categoryId}
                style={{ '--c': category(c.categoryId).color, flexGrow: c.monthly || 0.0001 } as CSSProperties}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: i * 0.05 }}
              />
            ))}
          </div>
          <div className="legend">
            {cats.map((c) => {
              const cat = category(c.categoryId);
              return (
                <div key={c.categoryId} className="legend__row">
                  <i className="legend__dot" style={{ '--c': cat.color } as CSSProperties} />
                  <span className="legend__name">
                    {cat.emoji} {categoryName(cat)} <span className="muted">· {c.count}</span>
                  </span>
                  <span className="num">{money(c.monthly, undefined, { round: true })}</span>
                  <span className="legend__pct num">{sum.monthly ? Math.round((c.monthly / sum.monthly) * 100) : 0}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </Section>

      <Section title={t('stats.forecast')} aside={money(yearAhead, undefined, { round: true })}>
        <div className="card card--pad">
          <div className="leader leader--strong">
            <span>{monthTitle(pickedMonth.month, lang)}</span>
            <span>{money(pickedMonth.total, undefined, { round: true })}</span>
          </div>
          <div className="muted mono" style={{ marginTop: 6 }}>
            {tn('charges', pickedMonth.count)}
          </div>
          <div className="bars" role="group" aria-label={t('stats.forecast')}>
            {months.map((m, i) => (
              <button key={m.month} type="button" className="bar-col" aria-pressed={i === picked} onClick={() => setPicked(i)} aria-label={`${monthTitle(m.month, lang)}: ${money(m.total)}`}>
                <motion.span
                  className="bar-col__bar"
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(2, (m.total / peak) * 100)}%` }}
                  transition={{ type: 'spring', stiffness: 200, damping: 24, delay: i * 0.03 }}
                />
                <span className="bar-col__label">{monthShort(m.month, lang)}</span>
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section title={t('stats.top')}>
        <div className="card rows">
          {ranked.map(({ s, v }) => (
            <button key={s.id} type="button" className="rank" style={{ '--brand': s.color } as CSSProperties} onClick={() => go(`/sub/${s.id}`)}>
              <ServiceMark name={s.name} color={s.color} service={s.service} size={34} />
              <span style={{ minWidth: 0 }}>
                <span className="ticket__name" style={{ display: 'block', fontSize: 15 }}>
                  {s.name}
                </span>
                <span className="rank__bar">
                  <i style={{ width: `${(v / top) * 100}%` }} />
                </span>
              </span>
              <span className="num" style={{ fontWeight: 600 }}>
                {money(v, undefined, { round: v >= 100 })}
              </span>
            </button>
          ))}
        </div>
        <div className="mono center">{t('stats.perMonthNote')}</div>
      </Section>

      {(shared.length > 0 || paused.length > 0) && (
        <Section title={t('stats.insights')}>
          <div className="card card--pad history">
            {shared.length > 0 && <Leader label={t('stats.savedSharing', { n: shared.length })} value={money(saved, undefined, { round: true })} strong />}
            {paused.length > 0 && (
              <Leader
                label={t('stats.savedPaused', { n: paused.length })}
                value={money(
                  paused.reduce((acc, s) => acc + (toBase(monthlyCost(s), s.currency, settings.currency, settings.rates) ?? 0), 0),
                  undefined,
                  { round: true },
                )}
              />
            )}
          </div>
        </Section>
      )}

      {sum.missing.length > 0 && (
        <div className="note">
          <Icon name="coins" />
          <div className="note__body muted">{t('home.noRateTitle', { list: sum.missing.join(', ') })}</div>
        </div>
      )}
    </div>
  );
}
