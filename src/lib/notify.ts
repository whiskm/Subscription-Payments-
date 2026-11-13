import { plural, translate } from '../i18n';
import { addDays, parts, todayISO } from './dates';
import { formatMoney } from './money';
import { isNative } from './platform';
import { daysLeft, isCounted, occurrences, ownShare, remindDaysFor } from './schedule';
import type { ISODate, Settings, Subscription } from './types';

const LOOKAHEAD_DAYS = 70;
/** Android keeps at most a few hundred pending alarms; iOS only 64. Stay well below. */
const MAX_PENDING = 48;
const WEB_SHOWN_KEY = 'sp:notified';

export type NotifyState = 'granted' | 'denied' | 'prompt' | 'unsupported';

export async function notifyState(): Promise<NotifyState> {
  if (isNative) {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const p = await LocalNotifications.checkPermissions();
    return p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'prompt';
  }
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission === 'default' ? 'prompt' : Notification.permission;
}

export async function requestNotify(): Promise<NotifyState> {
  if (isNative) {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const p = await LocalNotifications.requestPermissions();
    return p.display === 'granted' ? 'granted' : 'denied';
  }
  if (typeof Notification === 'undefined') return 'unsupported';
  const p = await Notification.requestPermission();
  return p === 'default' ? 'prompt' : p;
}

function message(sub: Subscription, days: number, s: Settings): { title: string; body: string } {
  const amount = s.hideAmounts ? '' : ` · ${formatMoney(ownShare(sub), sub.currency, s.lang)}`;
  const when =
    days < 0 ? plural(s.lang, 'daysOverdue', -days) : days === 0 ? translate(s.lang, 'due.today') : plural(s.lang, 'inDays', days);
  const key = sub.status === 'trial' ? 'notify.trial' : sub.status === 'cancelled' ? 'notify.ends' : 'notify.payment';
  return { title: sub.name, body: `${translate(s.lang, key)}: ${when}${amount}` };
}

function at(date: ISODate, time: string): Date {
  const { y, m, d } = parts(date);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min, 0, 0);
}

interface Planned {
  when: Date;
  title: string;
  body: string;
}

/** Every reminder that should fire in the coming weeks, soonest first. */
export function planReminders(subs: Subscription[], s: Settings, today: ISODate = todayISO(), now = new Date()): Planned[] {
  const until = addDays(today, LOOKAHEAD_DAYS);
  const planned: Planned[] = [];
  for (const sub of subs) {
    if (sub.status === 'paused') continue;
    const dates = isCounted(sub) ? occurrences(sub, today, until) : sub.nextDate >= today ? [sub.nextDate] : [];
    for (const date of dates) {
      for (const before of remindDaysFor(sub, s.remindDays)) {
        const when = at(addDays(date, -before), s.notifyTime);
        if (when > now) planned.push({ when, ...message(sub, before, s) });
      }
    }
  }
  return planned.sort((a, b) => a.when.getTime() - b.when.getTime()).slice(0, MAX_PENDING);
}

/** Android: replaces all scheduled reminders with a fresh plan. */
export async function syncNotifications(subs: Subscription[], s: Settings): Promise<void> {
  if (!isNative) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    if (!s.notifications || (await notifyState()) !== 'granted') return;
    const plan = planReminders(subs, s);
    if (!plan.length) return;
    await LocalNotifications.schedule({
      notifications: plan.map((p, i) => ({ id: i + 1, title: p.title, body: p.body, schedule: { at: p.when, allowWhileIdle: true } })),
    });
  } catch {
    /* reminders are best-effort */
  }
}

/**
 * Browsers cannot schedule a notification for later without a server, so on
 * the web we notify once a day, when the app is opened, about what is due.
 */
export async function notifyOnOpen(subs: Subscription[], s: Settings, today: ISODate = todayISO()): Promise<void> {
  if (isNative || !s.notifications || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    if (localStorage.getItem(WEB_SHOWN_KEY) === today) return;
    const due = subs.filter((sub) => {
      if (sub.status === 'paused') return false;
      const left = daysLeft(sub, today);
      if (sub.status === 'cancelled') return left >= 0 && remindDaysFor(sub, s.remindDays).includes(left);
      return left < 0 || remindDaysFor(sub, s.remindDays).includes(left);
    });
    localStorage.setItem(WEB_SHOWN_KEY, today);
    if (!due.length) return;
    const first = message(due[0], daysLeft(due[0], today), s);
    const title = due.length === 1 ? first.title : plural(s.lang, 'needAttention', due.length);
    const body = due.length === 1 ? first.body : due.slice(0, 4).map((d) => d.name).join(', ');
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, tag: 'sp-due', icon: '/icons/icon-192.png' });
    else new Notification(title, { body, tag: 'sp-due' });
  } catch {
    /* best-effort */
  }
}
