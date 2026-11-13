import { parts } from './dates';
import { remindDaysFor, isCounted } from './schedule';
import type { Category, Settings, Subscription } from './types';

// ---- CSV -------------------------------------------------------------------

function csvCell(value: string | number | undefined): string {
  let s = value === undefined ? '' : String(value);
  // Spreadsheets run cells starting with these characters as formulas.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export interface CsvLabels {
  headers: string[];
  category: (c: Category | undefined) => string;
  cycle: (s: Subscription) => string;
  status: (s: Subscription) => string;
}

/** A spreadsheet-friendly list. Logins and passwords are never included. */
export function toCSV(subs: Subscription[], categories: Category[], labels: CsvLabels): string {
  const cats = new Map(categories.map((c) => [c.id, c]));
  const rows = subs.map((s) =>
    [
      s.name,
      labels.category(cats.get(s.categoryId)),
      s.price,
      s.currency,
      labels.cycle(s),
      s.nextDate,
      labels.status(s),
      s.share > 1 ? s.share : '',
      s.paymentMethod,
      s.url,
      s.notes,
    ]
      .map(csvCell)
      .join(','),
  );
  // The BOM makes Excel read the file as UTF-8.
  return '\uFEFF' + [labels.headers.map(csvCell).join(','), ...rows].join('\r\n') + '\r\n';
}

// ---- iCalendar -------------------------------------------------------------

const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

const icsDate = (iso: string) => iso.replace(/-/g, '');

/** Lines longer than 75 bytes must be folded. */
function fold(line: string): string {
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = new TextEncoder().encode(ch).length;
    if (bytes + size > 73) {
      out.push(current);
      current = ' ';
      bytes = 1;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join('\r\n');
}

function rrule(s: Subscription): string {
  const { every, unit } = s.cycle;
  const freq = { day: 'DAILY', week: 'WEEKLY', month: 'MONTHLY', year: 'YEARLY' }[unit];
  let rule = `FREQ=${freq};INTERVAL=${every}`;
  const day = s.billingDay ?? parts(s.nextDate).d;
  // "The 31st" should land on the last day of shorter months instead of skipping them.
  if (unit === 'month' && day > 28) {
    const days = Array.from({ length: day - 27 }, (_, i) => 28 + i).join(',');
    rule += `;BYMONTHDAY=${days};BYSETPOS=-1`;
  }
  return rule;
}

function alarmTrigger(daysBefore: number, time: string): string {
  const [h, m] = time.split(':').map(Number);
  const minutes = daysBefore * 1440 - (h * 60 + m);
  return minutes > 0 ? `-PT${minutes}M` : `PT${-minutes}M`;
}

export interface IcsLabels {
  calendarName: string;
  summary: (s: Subscription) => string;
  description: (s: Subscription) => string;
}

/** A calendar file the phone's own calendar can import; it then does the reminding. */
export function toICS(subs: Subscription[], settings: Pick<Settings, 'remindDays' | 'notifyTime'>, labels: IcsLabels, now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Subscription Payments//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsText(labels.calendarName)}`,
  ];
  for (const s of subs) {
    if (!isCounted(s)) continue;
    const next = new Date(Date.UTC(parts(s.nextDate).y, parts(s.nextDate).m - 1, parts(s.nextDate).d + 1));
    lines.push(
      'BEGIN:VEVENT',
      `UID:${s.id}@subscription-payments`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(s.nextDate)}`,
      `DTEND;VALUE=DATE:${icsDate(next.toISOString().slice(0, 10))}`,
      `SUMMARY:${icsText(labels.summary(s))}`,
      `DESCRIPTION:${icsText(labels.description(s))}`,
      'TRANSP:TRANSPARENT',
    );
    if (s.autoRenew) lines.push(`RRULE:${rrule(s)}`);
    for (const d of remindDaysFor(s, settings.remindDays)) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(labels.summary(s))}`, `TRIGGER:${alarmTrigger(d, settings.notifyTime)}`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
