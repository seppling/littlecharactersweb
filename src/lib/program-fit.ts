/**
 * One class page template serves weekly classes, the free class, a school's
 * class, parties, private lessons, Parents' Night Out and the adult drop-in.
 * These rules choose what each one says, from its kind, its price and its
 * dates, so a line only shows where it's true: no "15% off" on a free class,
 * no tuition questions on a party, no "first class" on a one-night booking.
 */
import { kindLabels } from '@/content/catalog';
import type { Faq, Program, Session } from '@/content/types';
import { clock, timeOf, timeRange } from '@/lib/format';
import { hasFreeFirstClass } from '@/lib/pricing';

/** How a program is booked and paid for. */
export type Fit = 'weekly' | 'school' | 'free' | 'drop-in' | 'night' | 'camp' | 'party' | 'lesson' | 'adaptive';

const isPartnerUrl = (url?: string) => !!url && !url.includes('docs.google.com');

/** One date, booked on its own (a night out, the free class, an improv night). */
export const isOneOff = (s: Pick<Session, 'startDate' | 'endDate'>) => s.startDate === s.endDate;

export const isAdult = (p: Pick<Program, 'ages'>) => p.ages.min >= 18;

export function programFit(p: Program): Fit {
  if (p.sessions.length > 0 && p.sessions.every((s) => isPartnerUrl(s.externalUrl))) return 'school';
  if (p.kind === 'camp') return 'camp';
  if (p.kind === 'lesson') return 'lesson';
  if (p.kind === 'inclusive') return 'adaptive';
  const prices = [p.priceFrom, ...p.sessions.map((s) => s.price)].filter((x) => x !== undefined);
  if (prices.length > 0 && prices.every((x) => x.amount === 0)) return 'free';
  if (p.kind === 'party') return p.sessions.length > 0 ? 'night' : 'party';
  if (p.sessions.length > 0 && p.sessions.every(isOneOff)) return 'drop-in';
  return 'weekly';
}

/**
 * The tag on cards and the class page. A "class" that meets on single dates
 * says how often from those dates: one a month in a row is a monthly drop-in.
 */
export function kindTag(p: Program) {
  if (programFit(p) !== 'drop-in') return kindLabels[p.kind].singular;
  const months = [...new Set(p.sessions.map((s) => s.startDate.slice(0, 7)))].sort();
  const monthly =
    months.length > 1 &&
    months.length === p.sessions.length &&
    months.every((m, i) => i === 0 || monthIndex(m) - monthIndex(months[i - 1]) === 1);
  return monthly ? 'Monthly drop-in' : 'Drop-in';
}

const monthIndex = (ym: string) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7));

/** The heading over the program's highlights, or what they are for this kind. */
export function highlightsHeading(p: Program) {
  switch (programFit(p)) {
    case 'party':
      return 'What’s included';
    case 'night':
    case 'drop-in':
      return 'What to expect';
    case 'lesson':
      return 'What we can help with';
    case 'free':
      return 'At a glance';
    default:
      return 'What they’ll practice';
  }
}

/** Lines in "Pricing & discounts", in order. An empty list hides the box. */
export type MoneyLine = 'school' | 'free' | 'trial' | 'monthly' | 'fee' | 'per-child' | 'per-night' | 'multi' | 'pay-what-you-can';

export function moneyLines(p: Program): MoneyLine[] {
  const fit = programFit(p);
  if (fit === 'school') return ['school'];
  if (fit === 'free') return ['free'];
  const price = p.priceFrom ?? p.sessions.find((s) => s.price)?.price;
  const paid = !!price && price.amount > 0;
  const lines: MoneyLine[] = [];
  if (hasFreeFirstClass(p)) lines.push('trial');
  if (price?.unit === 'month') lines.push('monthly');
  if (p.fee) lines.push('fee');
  if (fit === 'night' && paid && perChild(p)) lines.push('per-child');
  if (fit === 'drop-in' && paid) lines.push('per-night');
  // The same rule checkout uses: weekly classes with tuition (src/lib/pricing.ts).
  if (fit === 'weekly' && paid && (price.unit === 'month' || price.unit === 'session')) lines.push('multi');
  if ((fit === 'weekly' || fit === 'camp' || fit === 'adaptive') && paid && !isAdult(p)) lines.push('pay-what-you-can');
  return lines;
}

/** The first child's price and each additional child's, when they differ (Parents' Night Out). */
export function perChild(p: Program) {
  const price = [...p.sessions.map((s) => s.price), p.priceFrom].find((x) => x?.unit === 'child' && x.additional !== undefined);
  return price ? { first: price.amount, additional: price.additional! } : undefined;
}

type FaqPick = { group: Faq['group']; skip?: RegExp; only?: RegExp };

/**
 * Which FAQ groups a program's page shows. Tuition, unenrolling and the free
 * first class only belong where they apply; a class at a school skips our
 * parking; an adult night skips questions about children.
 */
const faqPicks: Record<Fit, FaqPick[]> = {
  weekly: [{ group: 'Classes' }, { group: 'Payments & discounts' }, { group: 'Performances' }],
  camp: [{ group: 'Camps & parties' }, { group: 'Payments & discounts' }],
  school: [{ group: 'Getting started', skip: /try a class|park/i }, { group: 'Classes', only: /how big/i }],
  free: [{ group: 'Getting started', skip: /try a class/i }, { group: 'Classes', only: /how big/i }],
  'drop-in': [{ group: 'Getting started', skip: /try a class|child/i }],
  night: [{ group: 'Getting started', skip: /try a class/i }],
  party: [{ group: 'Camps & parties', only: /part(y|ies)/i }, { group: 'Getting started', only: /needs|park/i }],
  lesson: [{ group: 'Getting started', skip: /try a class/i }, { group: 'Payments & discounts', only: /scholarship/i }],
  adaptive: [{ group: 'Getting started', skip: /try a class/i }, { group: 'Payments & discounts', only: /scholarship/i }],
};

export function faqsFor(p: Program, faqs: Faq[], max = 5) {
  const adult = isAdult(p);
  return faqPicks[programFit(p)]
    .flatMap(({ group, skip, only }) =>
      faqs.filter((f) => f.group === group && (!only || only.test(f.q)) && (!skip || !skip.test(`${f.q} ${adult ? f.a : ''}`))),
    )
    .slice(0, max);
}

const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

/**
 * When a one-date booking happens, in the words a confirmation uses:
 * "Saturday, October 24, 5–8 pm (drop-off from 5, pick-up by 8)". The
 * drop-off note is for nights out, where kids are left with us.
 */
export function oneOffWhen(p: Pick<Program, 'kind'>, s: Pick<Session, 'startDate' | 'start' | 'end'>) {
  const when = `${longDate(s.startDate)}, ${timeRange(s.start, s.end)}`;
  return p.kind === 'party' ? `${when} (drop-off from ${clock(s.start)}, pick-up by ${clock(s.end)})` : when;
}

/**
 * The short policy list families agree to before paying for a one-date
 * booking, in place of the monthly-tuition rules.
 */
export function oneOffPolicies(p: Program, s: Session) {
  const price = s.price ?? p.priceFrom;
  const lines = [
    price && price.amount > 0
      ? 'You pay for this date when you sign up. There’s no monthly tuition and no autopay.'
      : 'It’s free: there’s nothing to pay.',
  ];
  if (p.kind === 'party') lines.push(`Drop off from ${timeOf(s.start)} and pick up by ${timeOf(s.end)}.`);
  else if (isAdult(p)) lines.push(`Everyone taking part must be ${p.ages.min} or older.`);
  else lines.push('Doors lock 5 minutes after class starts; walk late students to the front door.');
  lines.push('Can’t make it? Let us know as soon as you can.');
  return lines;
}

/** What to know before arriving, on the confirmation page. Grown-ups aren't told to walk their child in. */
export function arrivalLines(p: Pick<Program, 'kind' | 'ages'>, parking: { walkIn: string; late: string }) {
  if (isAdult(p)) return ['Wear comfy clothes and bring a water bottle.', 'Park on Minor St and walk in to our front door on W Broad St.'];
  // A night out has a drop-off window, so the class-start door rule doesn't apply.
  return ['Wear comfy clothes and closed-toe shoes, and bring a water bottle.', parking.walkIn, ...(p.kind === 'party' ? [] : [parking.late])];
}
