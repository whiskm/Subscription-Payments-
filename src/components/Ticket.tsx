import { useMemo, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BRAND_ICONS } from '../data/brandIcons';
import { getService } from '../data/catalog';
import { cycleProgress, daysLeft, ownShare, urgency, type Urgency } from '../lib/schedule';
import type { Subscription } from '../lib/types';
import { useApp } from '../state/app';

/** Light brand colours need dark artwork on top, and the other way round. */
export function needsDarkInk(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45;
}

export function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '·';
  const first = [...words[0]][0] ?? '';
  // CJK names read better as a single character.
  if (/[㐀-鿿]/.test(first)) return first;
  const second = words.length > 1 ? ([...words[1]][0] ?? '') : '';
  return (first + (/[\p{L}\d]/u.test(second) ? second : '')).toUpperCase();
}

export function ServiceMark({ name, color, service, size }: { name: string; color: string; service?: string; size?: number }) {
  const slug = getService(service)?.si;
  const path = slug ? BRAND_ICONS[slug] : undefined;
  const style = { '--brand': color, ...(size ? { '--size': `${size}px` } : {}) } as CSSProperties;
  return (
    <span className="mark" style={style} data-fg={needsDarkInk(color) ? 'dark' : 'light'} aria-hidden>
      {path ? (
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d={path} />
        </svg>
      ) : (
        monogram(name)
      )}
    </span>
  );
}

export function Punches({ progress, count = 12 }: { progress: number; count?: number }) {
  const on = Math.round(progress * count);
  return (
    <span className="punches" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <i key={i} className="punch" data-on={i < on ? '' : undefined} />
      ))}
    </span>
  );
}

export function Stamp({ children, tone, big }: { children: string; tone?: 'quiet' | 'good'; big?: boolean }) {
  return <span className={['stamp', tone ? `stamp--${tone}` : '', big ? 'stamp--big' : ''].join(' ').trim()}>{children}</span>;
}

/** A decorative barcode drawn from the subscription's id, so every ticket has its own. */
export function Barcode({ seed, width = 132, height = 46 }: { seed: string; width?: number; height?: number }) {
  const bars = useMemo(() => {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
    const out: Array<{ x: number; w: number }> = [];
    let x = 0;
    while (x < width) {
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      const w = 1 + ((h >>> 8) & 3);
      const gap = 1 + ((h >>> 12) & 3);
      if (x + w > width) break;
      out.push({ x, w });
      x += w + gap;
    }
    return out;
  }, [seed, width]);
  return (
    <svg className="barcode" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      {bars.map((b) => (
        <rect key={b.x} x={b.x} y={0} width={b.w} height={height} fill="currentColor" />
      ))}
    </svg>
  );
}

export function ticketCode(id: string): string {
  const clean = id.replace(/[^a-z0-9]/gi, '').toUpperCase();
  return `SP-${clean.slice(0, 4)}-${clean.slice(4, 8)}`;
}

export interface StubInfo {
  urgency: Urgency;
  num: string;
  label: string;
}

export function useStub(sub: Subscription): StubInfo {
  const { today, t, tn, settings } = useApp();
  const soon = Math.max(1, ...(sub.remindDays?.length ? sub.remindDays : settings.remindDays), 3);
  const u = urgency(sub, today, soon);
  const left = daysLeft(sub, today);
  if (sub.status === 'paused') return { urgency: u, num: '‖', label: t('status.paused') };
  if (sub.status === 'cancelled' && left < 0) return { urgency: u, num: '—', label: t('stub.ended') };
  if (left < 0) return { urgency: u, num: String(-left), label: tn('stubOverdue', -left) };
  if (left === 0) return { urgency: u, num: '0', label: t('due.today') };
  return { urgency: u, num: String(left), label: tn(sub.status === 'cancelled' ? 'stubUntilEnd' : 'stubDays', left) };
}

export function Ticket({ sub, onClick }: { sub: Subscription; onClick?: () => void }) {
  const { today, money, date, category, categoryName, perLabel, t } = useApp();
  const stub = useStub(sub);
  const cat = category(sub.categoryId);
  const style = { '--brand': sub.color } as CSSProperties;

  const inner = (
    <span className="ticket__paper">
      <span className="ticket__main">
        <ServiceMark name={sub.name} color={sub.color} service={sub.service} />
        <span className="ticket__body">
          <span className="ticket__name" style={{ display: 'block' }}>
            {sub.name}
          </span>
          <span className="ticket__meta mono" style={{ display: 'block' }}>
            {[categoryName(cat), sub.share > 1 ? `÷${sub.share}` : '', sub.paymentMethod ?? ''].filter(Boolean).join(' · ')}
          </span>
        </span>
        <span className="ticket__price">
          {money(ownShare(sub), sub.currency)}
          <span className="ticket__per">{perLabel(sub.cycle)}</span>
        </span>
        <span className="ticket__foot">
          {sub.status === 'trial' ? (
            <Stamp>{t('status.trial')}</Stamp>
          ) : sub.status === 'cancelled' ? (
            <Stamp tone="quiet">{t('status.cancelled')}</Stamp>
          ) : (
            <Punches progress={sub.status === 'paused' ? 0 : cycleProgress(sub, today)} />
          )}
          <span className="ticket__date">{date(sub.nextDate)}</span>
        </span>
      </span>
      <span className="ticket__stub">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={sub.nextDate + sub.status}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}
            initial={{ y: -26, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, rotate: 14, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          >
            <span className="stub__num" data-len={stub.num.length}>
              {stub.num}
            </span>
            <span className="stub__label">{stub.label}</span>
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );

  return onClick ? (
    <button type="button" className="ticket" style={style} data-urgency={stub.urgency} onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div className="ticket" style={style} data-urgency={stub.urgency}>
      {inner}
    </div>
  );
}

/** Tickets that slide in one after another. */
export function TicketList({ subs, onOpen }: { subs: Subscription[]; onOpen: (s: Subscription) => void }) {
  return (
    <div className="stack-v">
      <AnimatePresence initial={false} mode="popLayout">
        {subs.map((s, i) => (
          <motion.div
            key={s.id}
            layout="position"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 360, damping: 32, delay: Math.min(i, 8) * 0.025 }}
          >
            <Ticket sub={s} onClick={() => onOpen(s)} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
