import { useMemo, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Icon } from '../components/icons';
import { TicketList } from '../components/Ticket';
import { TopBar } from '../components/TopBar';
import { IconButton, Leader, Section } from '../components/ui';
import { addMonths, daysInMonth, endOfMonth, isoFromParts, parts, startOfMonth } from '../lib/dates';
import { monthTitle, weekColumn, weekdayNames } from '../lib/format';
import { toBase } from '../lib/money';
import { occurrences, ownShare } from '../lib/schedule';
import type { ISODate, Subscription } from '../lib/types';
import { useApp } from '../state/app';
import { go } from '../state/router';

interface Charge {
  sub: Subscription;
  date: ISODate;
  /** Past charges come from the payment log, future ones are projected. */
  past: boolean;
  amount: number;
  currency: string;
}

export function Calendar() {
  const { subs, settings, today, lang, t, tn, money, date } = useApp();
  const [month, setMonth] = useState(startOfMonth(today));
  const [selected, setSelected] = useState<ISODate | null>(null);
  const [dir, setDir] = useState(0);

  const charges = useMemo(() => {
    const from = month;
    const to = endOfMonth(month);
    const list: Charge[] = [];
    for (const sub of subs) {
      for (const p of sub.payments) if (p.date >= from && p.date <= to) list.push({ sub, date: p.date, past: true, amount: p.amount, currency: p.currency });
      const start = from > today ? from : today;
      for (const d of occurrences(sub, start, to)) {
        if (!list.some((c) => c.sub.id === sub.id && c.date === d)) list.push({ sub, date: d, past: false, amount: ownShare(sub), currency: sub.currency });
      }
      // The day a cancelled subscription runs out is worth seeing too.
      if (sub.status === 'cancelled' && sub.nextDate >= from && sub.nextDate <= to && sub.nextDate >= today) {
        list.push({ sub, date: sub.nextDate, past: false, amount: 0, currency: sub.currency });
      }
    }
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [subs, month, today]);

  const byDay = useMemo(() => {
    const map = new Map<ISODate, Charge[]>();
    for (const c of charges) map.set(c.date, [...(map.get(c.date) ?? []), c]);
    return map;
  }, [charges]);

  const total = charges.reduce((sum, c) => sum + (toBase(c.amount, c.currency, settings.currency, settings.rates) ?? 0), 0);
  const { y, m } = parts(month);
  const lead = weekColumn(month, settings.weekStart);
  const cells: Array<ISODate | null> = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth(y, m) }, (_, i) => isoFromParts(y, m, i + 1))];
  while (cells.length % 7) cells.push(null);

  const shift = (n: number) => {
    setDir(n);
    setMonth((cur) => addMonths(cur, n));
    setSelected(null);
  };

  const dayList = selected ? (byDay.get(selected) ?? []) : [];

  return (
    <div className="screen">
      <TopBar
        kicker={tn('charges', charges.filter((c) => c.amount > 0).length)}
        title={monthTitle(month, lang)}
        actions={
          <>
            <IconButton icon="chevL" label={t('cal.prev')} onClick={() => shift(-1)} />
            <IconButton icon="chevR" label={t('cal.next')} onClick={() => shift(1)} />
          </>
        }
      />

      <motion.div
        className="card cal"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.18}
        onDragEnd={(_, info) => {
          if (info.offset.x < -60) shift(1);
          else if (info.offset.x > 60) shift(-1);
        }}
      >
        <div className="cal__grid">
          {weekdayNames(lang, settings.weekStart).map((d, i) => (
            <div key={i} className="cal__dow">
              {d}
            </div>
          ))}
        </div>
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={month}
            className="cal__grid"
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          >
            {cells.map((d, i) => {
              if (!d) return <div key={`e${i}`} className="cal__day" data-out="" />;
              const list = byDay.get(d) ?? [];
              return (
                <button
                  key={d}
                  type="button"
                  className="cal__day"
                  data-today={d === today ? '' : undefined}
                  data-past={d < today ? '' : undefined}
                  aria-pressed={selected === d}
                  aria-label={`${date(d, { year: true })}${list.length ? `, ${list.map((c) => c.sub.name).join(', ')}` : ''}`}
                  onClick={() => setSelected((cur) => (cur === d ? null : d))}
                >
                  {parts(d).d}
                  <span className="cal__dots">
                    {list.slice(0, 3).map((c, j) => (
                      <i key={j} style={{ '--c': c.sub.color } as CSSProperties} />
                    ))}
                    {list.length > 3 && <span className="cal__more">+</span>}
                  </span>
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {startOfMonth(today) !== month && (
        <button className="btn btn--ghost btn--small" style={{ alignSelf: 'center' }} onClick={() => {
            setDir(month > today ? -1 : 1);
            setMonth(startOfMonth(today));
            setSelected(null);
          }}>
          {t('cal.today')}
        </button>
      )}

      {selected ? (
        <Section title={date(selected, { year: true })} aside={t('common.clear')} onAside={() => setSelected(null)}>
          {dayList.length ? (
            <TicketList subs={dayList.map((c) => c.sub)} onOpen={(s) => go(`/sub/${s.id}`)} />
          ) : (
            <div className="note">
              <Icon name="calendar" />
              <div className="note__body muted">{t('cal.free')}</div>
            </div>
          )}
        </Section>
      ) : (
        <Section title={t('cal.month')} aside={money(total, undefined, { round: true })}>
          {charges.length ? (
            <div className="card card--pad history">
              {charges.map((c, i) => (
                <button key={i} type="button" style={{ textAlign: 'left' }} onClick={() => go(`/sub/${c.sub.id}`)}>
                  <Leader
                    label={
                      <>
                        <span className="num">{date(c.date)}</span> · <span style={{ color: 'var(--ink)' }}>{c.sub.name}</span>
                        {c.past && ' ✓'}
                      </>
                    }
                    value={c.amount ? money(c.amount, c.currency) : t('cal.accessEnds')}
                  />
                </button>
              ))}
            </div>
          ) : (
            <div className="note">
              <Icon name="calendar" />
              <div className="note__body muted">{t('cal.empty')}</div>
            </div>
          )}
        </Section>
      )}
    </div>
  );
}
