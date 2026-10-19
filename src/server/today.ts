/**
 * The staff home page, Today, and its "Needs attention" list
 * (docs/back-office.md → Today and Needs attention).
 *
 * - todayClasses: the classes and events meeting on a day, with places filled,
 *   and the next day with classes when there are none.
 * - attentionItems: everything that needs a person, most urgent first. The
 *   full list is /admin/attention; Today shows the top of it.
 * - attentionCount: the alert and warning items, for the count on the Alerts
 *   tab. Three quick queries, shared by everything that asks during one request.
 *
 * Each has a pure half (classesOn, nextClassDay, attentionFrom) that takes
 * plain data and a date, so Phase 2's dashboard can build on them and the
 * unit tests need no database.
 */
import { eq, inArray } from 'drizzle-orm';
import type { EventItem } from '@/content/types';
import type { SiteContent } from '@/content/site-content';
import * as links from '@/lib/admin-links';
import { daysToBirthday } from '@/lib/badges';
import { timeRange } from '@/lib/format';
import { isOneOff } from '@/lib/program-fit';
import { formatCents, meetings, todayInAthens } from '@/lib/pricing';
import { bookingClock } from '@/lib/session-dates';
import { detailsOnFile } from '@/lib/student-details';
import { sessionCounts } from './admin';
import { billingOverview, totalDue } from './billing';
import { classRows, MIN_TO_RUN, placesLabel, type ClassRow } from './classes';
import { getDb, schema } from './db';
import { LEAD_LABELS, staffLeads } from './leads';
import { openOfferCounts } from './roster-changes';

type Content = Pick<SiteContent, 'programs' | 'events' | 'locationById' | 'site' | 'findSession' | 'programBySlug'>;

const DAY = 86_400_000;
const utc = (iso: string) => Date.parse(`${iso}T12:00:00Z`);
export const addDays = (iso: string, days: number) => new Date(utc(iso) + days * DAY).toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) => Math.round((utc(to) - utc(from)) / DAY);

/** "Tuesday, October 20" */
export const longDay = (iso: string) => new Date(utc(iso)).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
/** "Tue, Oct 20" */
export const shortDay = (iso: string) => new Date(utc(iso)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

// ───────────── Today's classes ─────────────

export interface TodayClass {
  /** "16:30", for sorting; empty when an event has no time. */
  start: string;
  /** "4:30–5:30 pm" */
  time: string;
  title: string;
  /** The session's label ("Ages 4–6"), when it says more than the date. */
  label: string;
  location: string;
  teacher: string;
  /** "8 of 12"; empty for an event. */
  places: string;
  /** The class's staff page; the event's page on the site for an event. */
  href: string;
  kind: 'class' | 'event';
}

const eventLocation = (e: EventItem, content: Pick<Content, 'locationById'>) => e.venue || content.locationById(e.locationId)?.shortName || '';

/**
 * What meets on `date` (YYYY-MM-DD): every staff session with a class that
 * day, and the site's events that day that aren't booked through one of those
 * sessions (a show, a community event). By start time.
 */
export function classesOn(rows: ClassRow[], events: EventItem[], date: string, content: Pick<Content, 'locationById'>): TodayClass[] {
  const meeting = rows.filter((r) => meetings(r.session).includes(date));
  const out: TodayClass[] = meeting.map((r) => ({
    start: r.session.start,
    time: r.session.start && r.session.end ? timeRange(r.session.start, r.session.end) : '',
    title: r.program.title,
    label: r.label,
    location: r.location,
    teacher: r.teacher,
    places: placesLabel(r),
    href: links.classPage(r.session.id),
    kind: 'class',
  }));
  const bookedPrograms = new Set(meeting.map((r) => r.program.slug));
  for (const e of events) {
    if (e.programSlug && bookedPrograms.has(e.programSlug)) continue;
    for (const t of e.times) {
      if (t.start.slice(0, 10) !== date) continue;
      const start = t.start.slice(11, 16);
      const end = t.end?.slice(11, 16) ?? '';
      out.push({
        start,
        time: start && end ? timeRange(start, end) : '',
        title: e.title,
        label: '',
        location: eventLocation(e, content),
        teacher: '',
        places: '',
        href: e.kind === 'show' ? `/events/${e.slug}` : `/events#${e.slug}`,
        kind: 'event',
      });
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
}

/** The first day after `date`, within `withinDays`, with a class or event; null if none. */
export function nextClassDay(rows: ClassRow[], events: EventItem[], date: string, content: Pick<Content, 'locationById'>, withinDays = 120) {
  for (let i = 1; i <= withinDays; i++) {
    const day = addDays(date, i);
    const classes = classesOn(rows, events, day, content);
    if (classes.length) return { date: day, classes };
  }
  return null;
}

async function allRows(content: Content, now: Date) {
  return classRows(content, await sessionCounts(), bookingClock(content.site.lateJoinWeeks, now));
}

/** Today's classes in Athens, and the next day with classes when there are none. `date` overrides the day (development only). */
export async function todayClasses(content: Content, now = new Date(), date = todayInAthens(now)) {
  const rows = await allRows(content, now);
  const classes = classesOn(rows, content.events, date, content);
  return { date, classes, next: classes.length ? null : nextClassDay(rows, content.events, date, content) };
}

// ───────────── Needs attention ─────────────

export type AttentionKind = 'payments' | 'waitlist' | 'under5' | 'emergency' | 'care' | 'signups' | 'leads' | 'birthdays';
export type AttentionTone = 'alert' | 'warning' | 'neutral' | 'good';

export interface AttentionItem {
  kind: AttentionKind;
  tone: AttentionTone;
  title: string;
  detail: string;
  /** The one next step. */
  action: { label: string; href: string };
}

/** The kinds, most urgent first, with their heading on the full list. */
export const ATTENTION_KINDS: { kind: AttentionKind; tone: AttentionTone; heading: string }[] = [
  { kind: 'payments', tone: 'alert', heading: 'Payments that need a look' },
  { kind: 'waitlist', tone: 'warning', heading: 'Waitlist openings' },
  { kind: 'under5', tone: 'warning', heading: `Classes under ${MIN_TO_RUN}` },
  { kind: 'emergency', tone: 'warning', heading: 'No emergency contact' },
  { kind: 'care', tone: 'neutral', heading: 'Care details to confirm' },
  { kind: 'signups', tone: 'good', heading: 'New sign-ups this week' },
  { kind: 'leads', tone: 'neutral', heading: 'New messages and sign-ups' },
  { kind: 'birthdays', tone: 'good', heading: 'Birthdays this week' },
];
const URGENT = new Set<AttentionTone>(['alert', 'warning']);
export const isUrgent = (i: Pick<AttentionItem, 'tone'>) => URGENT.has(i.tone);

/** "Under 5" shows from 14 days before a class's first meeting to 14 days after it ("about two weeks into the season"). */
export const UNDER5_WINDOW_DAYS = 14;
/** New sign-ups and new messages: the last 7 days. */
export const RECENT_DAYS = 7;
/** Birthdays: today and the next 6 days. */
export const BIRTHDAY_DAYS = 7;

export interface AttentionPayment {
  id: string;
  family: string;
  label: string;
  dueDate: string;
  status: 'failed' | 'processing' | string;
  amountCents: number;
  lastError: string | null;
  retryOn: string | null;
  /** The family opened "Pay now" and is paying it themselves. */
  payNowOpenedAt: Date | null;
}

/** One child's enrollment (active or trial), with what the list needs about them and their family. */
export interface EnrolledChild {
  enrollmentId: string;
  sessionId: string;
  status: 'active' | 'trial';
  createdAt: Date;
  studentId: string;
  firstName: string;
  lastName: string;
  birthdate: string | null;
  detailsConfirmedAt: Date | null;
  householdId: string;
  family: string;
  emergencyContacts: number;
}

export interface AttentionLead {
  createdAt: Date;
  kind: string;
}

export interface AttentionInput {
  payments: AttentionPayment[];
  classes: ClassRow[];
  enrolled: EnrolledChild[];
  /** Left out for the count, which doesn't need them. */
  leads?: AttentionLead[];
  /** Open waitlist offers per class (roster-changes.ts): those places are taken until the offer ends. */
  offers?: Record<string, number>;
}

const STAFF_REASON: Record<string, string> = {
  card_declined: 'card declined',
  insufficient_funds: 'not enough funds',
  expired_card: 'card expired',
  incorrect_cvc: 'card declined',
  processing_error: 'card network error',
  authentication_required: 'the bank wants the family to approve it',
  no_card: 'no card on file',
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const list = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const firstNames = (kids: EnrolledChild[]) => list([...new Set(kids.map((k) => k.firstName))]);
/** The age a child turns on their birthday `on`. */
const ageTurning = (birthdate: string, on: string) => Number(on.slice(0, 4)) - Number(birthdate.slice(0, 4));

function groupBy<T>(xs: T[], key: (x: T) => string) {
  const out = new Map<string, T[]>();
  for (const x of xs) out.set(key(x), [...(out.get(key(x)) ?? []), x]);
  return out;
}

/**
 * Everything that needs a person, most urgent first (ATTENTION_KINDS' order).
 * Pure: `today` is YYYY-MM-DD in Athens, `now` the moment for the 7-day and
 * one-year windows.
 */
export function attentionFrom(input: AttentionInput, content: Pick<Content, 'findSession'>, today: string, now: Date): AttentionItem[] {
  const items: AttentionItem[] = [];
  const titleOf = (sessionId: string) => content.findSession(sessionId)?.program.title ?? 'a class';
  // A current enrollment: its class hasn't ended.
  const current = input.enrolled.filter((e) => {
    const s = content.findSession(e.sessionId)?.session;
    return !!s && s.endDate >= today;
  });

  // 1. Failed or held payments.
  for (const p of input.payments) {
    const held = p.status === 'failed' && !!p.payNowOpenedAt && !p.retryOn;
    const title = p.status === 'processing' ? `Payment still processing: ${p.family}` : held ? `Payment on hold: ${p.family}` : `Payment failed: ${p.family}`;
    const why =
      p.status === 'processing'
        ? 'not confirmed yet'
        : held
          ? 'the family is paying it themselves'
          : [STAFF_REASON[p.lastError ?? ''] ?? 'didn’t go through', p.retryOn ? `tries again ${shortDay(p.retryOn)}` : 'no more automatic tries'].join(', ');
    items.push({ kind: 'payments', tone: 'alert', title, detail: `${formatCents(p.amountCents)} · ${p.label} · ${why}`, action: { label: 'See payments', href: links.payments('failed') } });
  }

  // 2. Waitlist openings: a class with a waitlist and a place open, not counting places already offered.
  for (const r of input.classes) {
    const openings = r.openings === undefined ? undefined : r.openings - (input.offers?.[r.session.id] ?? 0);
    if (r.state === 'ended' || r.waitlist === 0 || (openings !== undefined && openings <= 0)) continue;
    const open = openings === undefined ? 'Places open' : `${plural(openings, 'place')} open`;
    items.push({
      kind: 'waitlist',
      tone: 'warning',
      title: `Waitlist opening: ${r.program.title}${r.label ? ` (${r.label})` : ''}`,
      detail: `${open}, ${r.waitlist} waiting · ${r.when}`,
      action: { label: 'Offer a place', href: links.classPage(r.session.id) },
    });
  }

  // 3. Weekly classes under 5, around their first class.
  const short = input.classes.filter((r) => {
    if (r.state === 'ended' || r.program.kind !== 'class' || isOneOff(r.session) || r.filled >= MIN_TO_RUN) return false;
    const first = meetings(r.session)[0] ?? r.session.startDate;
    return Math.abs(daysBetween(today, first)) <= UNDER5_WINDOW_DAYS;
  });
  if (short.length) {
    items.push({
      kind: 'under5',
      tone: 'warning',
      title: short.length === 1 ? `${short[0].program.title} has ${short[0].filled} of the ${MIN_TO_RUN} it needs` : `${short.length} classes are under ${MIN_TO_RUN} students`,
      detail: short.length === 1 ? `${short[0].when} · starts ${shortDay(meetings(short[0].session)[0] ?? short[0].session.startDate)}` : short.map((r) => `${r.program.title} (${r.filled})`).join(', '),
      action: { label: 'See classes', href: `${links.classes()}?under5=1` },
    });
  }

  // 4. Families with a current enrollment and no emergency contact.
  for (const [householdId, kids] of groupBy(
    current.filter((e) => e.emergencyContacts === 0),
    (e) => e.householdId,
  )) {
    items.push({
      kind: 'emergency',
      tone: 'warning',
      title: `No emergency contact: ${kids[0].family}`,
      detail: `${firstNames(kids)} in ${list([...new Set(kids.map((k) => titleOf(k.sessionId)))])}`,
      action: { label: 'Open family', href: links.family(householdId) },
    });
  }

  // 5. Enrolled children whose care details a parent hasn't confirmed within a year.
  for (const [householdId, kids] of groupBy(
    current.filter((e) => !detailsOnFile(e, now)),
    (e) => e.householdId,
  )) {
    const children = [...new Map(kids.map((k) => [k.studentId, k])).values()];
    items.push({
      kind: 'care',
      tone: 'neutral',
      title: `Care details to confirm: ${kids[0].family}`,
      detail: `${firstNames(children)}: not confirmed by a parent in the past year`,
      action: { label: 'Open family', href: links.family(householdId) },
    });
  }

  // 6. New sign-ups in the last 7 days, by class.
  const since = now.getTime() - RECENT_DAYS * DAY;
  const recent = current.filter((e) => e.createdAt.getTime() >= since);
  for (const [sessionId, kids] of groupBy(recent, (e) => e.sessionId)) {
    items.push({
      kind: 'signups',
      tone: 'good',
      title: `${plural(kids.length, 'new sign-up')}: ${titleOf(sessionId)}`,
      detail: kids.map((k) => `${k.firstName} ${k.lastName.slice(0, 1)}.${k.status === 'trial' ? ' (free trial)' : ''}`).join(', '),
      action: { label: 'Open class', href: links.classPage(sessionId) },
    });
  }

  // 7. New messages and sign-ups from the site's forms in the last 7 days.
  const leads = (input.leads ?? []).filter((l) => l.createdAt.getTime() >= since);
  if (leads.length) {
    const kinds = [...groupBy(leads, (l) => l.kind)].map(([k, ls]) => `${LEAD_LABELS[k] ?? k}: ${ls.length}`);
    items.push({
      kind: 'leads',
      tone: 'neutral',
      title: `${plural(leads.length, 'new message or sign-up', 'new messages and sign-ups')} from the site`,
      detail: kinds.join(' · '),
      action: { label: 'Read them', href: links.leads() },
    });
  }

  // 8. Birthdays in the next 7 days among enrolled children.
  const birthdays = [...new Map(current.filter((e) => e.birthdate).map((e) => [e.studentId, e])).values()]
    .map((e) => ({ e, days: daysToBirthday(e.birthdate!, today) }))
    .filter((b) => b.days >= 0 && b.days < BIRTHDAY_DAYS)
    .sort((a, b) => a.days - b.days || a.e.firstName.localeCompare(b.e.firstName));
  for (const { e, days } of birthdays) {
    const on = addDays(today, days);
    const classes = list([...new Set(current.filter((c) => c.studentId === e.studentId).map((c) => titleOf(c.sessionId)))]);
    items.push({
      kind: 'birthdays',
      tone: 'good',
      title: `${e.firstName} ${e.lastName} turns ${ageTurning(e.birthdate!, on)} ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `on ${shortDay(on).split(',')[0]}`}`,
      detail: `${shortDay(on)} · ${classes}`,
      action: { label: 'Open family', href: links.family(e.householdId) },
    });
  }

  const order = new Map(ATTENTION_KINDS.map((k, i) => [k.kind, i]));
  return items.map((item, i) => ({ item, i })).sort((a, b) => order.get(a.item.kind)! - order.get(b.item.kind)! || a.i - b.i).map((x) => x.item);
}

/** The full list grouped by kind, in ATTENTION_KINDS' order, leaving out empty kinds. */
export function attentionGroups(items: AttentionItem[]) {
  return ATTENTION_KINDS.map((k) => ({ ...k, items: items.filter((i) => i.kind === k.kind) })).filter((g) => g.items.length);
}

/** How many of each kind Today shows before "See all": the families without an emergency contact get 5, the rest 3. */
export const TODAY_LIMITS: Partial<Record<AttentionKind, number>> = { emergency: 5 };
export const TODAY_LIMIT = 3;

/** Today's share of the list: the first few of each kind, and how many were left for "See all". */
export function todaysAttention(items: AttentionItem[]) {
  const shown: AttentionItem[] = [];
  let hidden = 0;
  for (const g of attentionGroups(items)) {
    const limit = TODAY_LIMITS[g.kind] ?? TODAY_LIMIT;
    shown.push(...g.items.slice(0, limit));
    hidden += Math.max(0, g.items.length - limit);
  }
  return { shown, hidden };
}

// ───────────── Loading ─────────────

/** Every active or trial enrollment, with its child and family. One query. */
async function enrolledChildren(): Promise<EnrolledChild[]> {
  const db = await getDb();
  const { enrollment, student, household } = schema;
  const rows = await db
    .select({
      enrollmentId: enrollment.id,
      sessionId: enrollment.sessionId,
      status: enrollment.status,
      createdAt: enrollment.createdAt,
      studentId: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      birthdate: student.birthdate,
      detailsConfirmedAt: student.detailsConfirmedAt,
      householdId: household.id,
      family: household.name,
      emergencyContacts: household.emergencyContacts,
    })
    .from(enrollment)
    .innerJoin(student, eq(student.id, enrollment.studentId))
    .innerJoin(household, eq(household.id, student.householdId))
    .where(inArray(enrollment.status, ['active', 'trial']));
  return rows.map((r) => ({ ...r, status: r.status as EnrolledChild['status'], emergencyContacts: r.emergencyContacts.length }));
}

type Core = Omit<AttentionInput, 'leads'>;

/** The three queries behind the list (payments, class counts, enrollments), shared within one request by `key`. */
const cache = new WeakMap<object, Promise<Core>>();
function loadCore(content: Content, now: Date, key?: object): Promise<Core> {
  const hit = key && cache.get(key);
  if (hit) return hit;
  const load = (async () => {
    const [overview, classes, enrolled, offers] = await Promise.all([billingOverview(todayInAthens(now)), allRows(content, now), enrolledChildren(), openOfferCounts(now)]);
    const payments = overview.needsAttention.map(({ i, family }) => ({
      id: i.id,
      family,
      label: i.label,
      dueDate: i.dueDate,
      status: i.status,
      amountCents: totalDue(i),
      lastError: i.lastError,
      retryOn: i.retryOn,
      payNowOpenedAt: i.payNowOpenedAt,
    }));
    return { payments, classes, enrolled, offers };
  })();
  if (key) cache.set(key, load);
  return load;
}

const leadTitle = (content: Pick<Content, 'programBySlug' | 'events'>) => (slug: string) => content.programBySlug(slug)?.title ?? content.events.find((e) => e.slug === slug)?.title;

/**
 * Everything that needs a person, most urgent first. Pass the request's
 * `Astro.locals` as `key` so the count in the shell reuses the same queries.
 * `date` overrides today (development only).
 */
export async function attentionItems(content: Content, now = new Date(), key?: object, date = todayInAthens(now)) {
  const [core, leads] = await Promise.all([loadCore(content, now, key), staffLeads(leadTitle(content))]);
  return attentionFrom({ ...core, leads }, content, date, now);
}

/** Alert and warning items: the count on the Alerts tab and on Today in the top bar. */
export async function attentionCount(content: Content, now = new Date(), key?: object) {
  return attentionFrom(await loadCore(content, now, key), content, todayInAthens(now), now).filter(isUrgent).length;
}


/** A `?on=YYYY-MM-DD` day for Today and Needs attention, honoured only in development (browser tests); null otherwise. */
export function devDay(params: URLSearchParams, allowed: boolean) {
  const on = params.get('on');
  return allowed && on && /^\d{4}-\d{2}-\d{2}$/.test(on) && !Number.isNaN(Date.parse(on)) ? on : null;
}
