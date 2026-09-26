import type { Fee, Price, Program, Session, Weekday } from '@/data/types';

const DAY_NAMES: Record<Weekday, string> = {
  Mon: 'Mondays', Tue: 'Tuesdays', Wed: 'Wednesdays', Thu: 'Thursdays', Fri: 'Fridays', Sat: 'Saturdays', Sun: 'Sundays',
};

/** "16:30" → "4:30" (meridiem added separately so ranges read "4:30–5:30 pm"). */
function clock(t: string) {
  const [h, m] = t.split(':').map(Number);
  const h12 = ((h + 11) % 12) + 1;
  return m === 0 ? `${h12}` : `${h12}:${String(m).padStart(2, '0')}`;
}
const meridiem = (t: string) => (Number(t.split(':')[0]) < 12 ? 'am' : 'pm');

export function timeOf(t: string) {
  return `${clock(t)} ${meridiem(t)}`;
}

export function timeRange(start: string, end: string) {
  const sameHalf = meridiem(start) === meridiem(end);
  return sameHalf
    ? `${clock(start)}–${clock(end)} ${meridiem(end)}`
    : `${clock(start)} ${meridiem(start)}–${clock(end)} ${meridiem(end)}`;
}

const d = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`);

export function shortDate(iso: string) {
  return d(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function dateRange(startIso: string, endIso: string) {
  if (startIso === endIso) return d(startIso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const s = d(startIso);
  const e = d(endIso);
  if (s.getMonth() === e.getMonth()) return `${shortDate(startIso)}–${e.getDate()}`;
  return `${shortDate(startIso)} – ${shortDate(endIso)}`;
}

export function dayList(days: Weekday[]) {
  if (days.length === 5 && days[0] === 'Mon' && days[4] === 'Fri') return 'Mon–Fri';
  if (days.length === 1) return DAY_NAMES[days[0]];
  if (days.length === 3 && days.join() === 'Mon,Tue,Wed') return 'Mon–Wed';
  if (days.length === 3 && days.join() === 'Tue,Wed,Thu') return 'Tue–Thu';
  return days.join(', ');
}

const UNIT: Record<Price['unit'], string> = {
  month: '/mo', week: '/wk', day: '/day', class: '/class', session: '/session', hour: '/hr', child: '/child',
};

export function price(p?: Price) {
  if (!p) return 'Pricing TBA';
  if (p.amount === 0) return 'Free';
  return `$${p.amount}${UNIT[p.unit]}`;
}

export function ageLabel(ages: Program['ages'], override?: string) {
  if (override) return override;
  if (ages.max === null) return ages.min >= 18 ? 'Adults 18+' : `Ages ${ages.min}+`;
  return `Ages ${ages.min}–${ages.max}`;
}

export const statusLabel: Record<Session['status'], string> = {
  open: 'Open',
  'few-left': 'Few spots left',
  waitlist: 'Waitlist',
  'coming-soon': 'Registration opens soon',
  closed: 'Closed',
};

export function spotsLabel(s: Session) {
  if (s.status === 'waitlist') return 'Full · join the waitlist';
  if (s.status === 'coming-soon') return 'Registration opens soon';
  if (typeof s.spotsLeft === 'number') return s.spotsLeft === 1 ? '1 spot left' : `${s.spotsLeft} spots left`;
  return statusLabel[s.status];
}

export function eventDate(iso: string) {
  const dt = new Date(iso);
  return {
    month: dt.toLocaleDateString('en-US', { month: 'short' }),
    day: dt.getDate(),
    weekday: dt.toLocaleDateString('en-US', { weekday: 'short' }),
    time: timeOf(iso.slice(11, 16)),
  };
}

export function feeLabel(fee?: Fee) {
  return fee ? `+ $${fee.amount} ${fee.label}` : '';
}
