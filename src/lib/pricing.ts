/**
 * Pricing engine: turns a program, a session, the chosen students and a
 * payment plan into order lines. Pure functions, no database, so every rule
 * is unit-tested (tests/unit/pricing.test.ts).
 *
 * Rules come from the Fall 2026 tuition guidelines:
 *  - Monthly classes: the first month is due at registration; the rest are
 *    charged automatically to the saved card on the 1st of each month.
 *    Joining after the first week prorates the first month. A class that
 *    starts mid-month charges its first month for the classes in it
 *    (decided Oct 13, 2026).
 *  - Classes priced per session (a block of weeks): the price is for every
 *    class; joining after the first week, or staying on after the free first
 *    class, pays for the classes left.
 *  - Pay for the season in full: 10% off.
 *  - Multi-class or multi-student families: 15% off tuition.
 *  - Discounts don't stack; each line gets the best one (PRICING.stackDiscounts).
 *  - One-time performance/materials fee per student.
 *  - New students' first class is free (a "trial": nothing due today) in
 *    Little Characters weekly classes, monthly or per session.
 *  - Drop-in nights (one-date sessions) never get the 15%.
 *  - Parents' Night Out: first child full price, each additional child less.
 */
import type { Price, Program, Session, Weekday } from '@/content/types';

export const PRICING = {
  multiDiscount: 0.15,
  payInFullDiscount: 0.1,
  stackDiscounts: false,
  /** Joining this many days after the first class prorates the first payment. */
  prorateAfterDays: 7,
  defaultClassCapacity: 20,
};

export type Plan = 'monthly' | 'full' | 'trial' | 'once' | 'waitlist';

export interface QuoteLine {
  kind: 'tuition' | 'fee' | 'discount';
  label: string;
  studentId?: string;
  amountCents: number;
}

/** A future automatic charge the family agrees to at checkout. */
export interface Installment {
  /** YYYY-MM-DD (always the 1st). */
  dueDate: string;
  amountCents: number;
  /** The same month before the 15% family discount (equal to amountCents when there's none). */
  regularAmountCents: number;
  label: string;
}

export interface Quote {
  plan: Plan;
  lines: QuoteLine[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  /** What comes after today's payment, e.g. "3 more monthly payments of $95". */
  later: string[];
  /** The same, as exact charges (monthly plan only). */
  installments: Installment[];
  notes: string[];
}

export interface QuoteInput {
  program: Program;
  session: Session;
  students: { id: string; firstName: string }[];
  plan: Plan;
  /** The family's other active class enrollments (for the multi-class discount). */
  otherClassEnrollments: number;
  /** YYYY-MM-DD, in Athens time. */
  today: string;
  /**
   * Students in this order who took their free first class in this session and
   * are now staying on. In a class priced per session they pay for the classes
   * left (decided Oct 13, 2026).
   */
  trialStudentIds?: string[];
}

// ───────────── Dates ─────────────

const DAY_INDEX: Record<Weekday, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const toDate = (iso: string) => new Date(`${iso}T12:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);
const monthKey = (iso: string) => iso.slice(0, 7);

/** Every class meeting (YYYY-MM-DD) between the session's start and end dates. */
export function meetings(session: Pick<Session, 'days' | 'startDate' | 'endDate'>): string[] {
  const days = new Set(session.days.map((d) => DAY_INDEX[d]));
  const out: string[] = [];
  for (let d = toDate(session.startDate); d <= toDate(session.endDate); d.setUTCDate(d.getUTCDate() + 1)) {
    if (days.has(d.getUTCDay())) out.push(toIso(d));
  }
  return out;
}

/** Today's date in Athens, GA as YYYY-MM-DD. */
export function todayInAthens(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** How many times the session's days fall in a calendar month ("2026-10"): the full month a class's first month is measured against. */
function classDaysInMonth(session: Pick<Session, 'days'>, month: string) {
  const days = new Set(session.days.map((d) => DAY_INDEX[d]));
  let n = 0;
  for (let d = toDate(`${month}-01`); monthKey(toIso(d)) === month; d.setUTCDate(d.getUTCDate() + 1)) {
    if (days.has(d.getUTCDay())) n++;
  }
  return n;
}

const joinedLate = (session: Pick<Session, 'startDate'>, today: string) =>
  toDate(today).getTime() - toDate(session.startDate).getTime() > PRICING.prorateAfterDays * 86_400_000;

/**
 * Monthly billing schedule from today (or the first class) to the end of the term.
 * Each entry is the share of that month's tuition owed (1 = full month) and the
 * number of classes it pays for.
 *
 *  - Late joiners (more than a week after the start): the first month they pay
 *    is prorated by its meetings left ÷ its meetings.
 *  - A session that starts mid-month (decided Oct 13, 2026): its first month is
 *    prorated by its classes that month ÷ the times the class's day falls in
 *    that calendar month. Acting Studio from Tue Oct 20: 2 of October's 4
 *    Tuesdays, so half of $95.
 */
export function monthlySchedule(session: Session, today: string) {
  const all = meetings(session);
  const remaining = all.filter((m) => m >= today);
  if (!remaining.length) return [];

  const byMonth = new Map<string, { total: number; remaining: number }>();
  for (const m of all) {
    const k = monthKey(m);
    const e = byMonth.get(k) ?? { total: 0, remaining: 0 };
    e.total++;
    if (m >= today) e.remaining++;
    byMonth.set(k, e);
  }

  const lateJoin = joinedLate(session, today);
  const sessionFirstMonth = monthKey(all[0]);
  const schedule: { month: string; share: number; classes: number }[] = [];
  for (const [month, e] of byMonth) {
    if (e.remaining === 0) continue;
    const isFirst = schedule.length === 0;
    const classes = isFirst && lateJoin ? e.remaining : e.total;
    let share = isFirst && lateJoin ? e.remaining / e.total : 1;
    if (month === sessionFirstMonth) share = Math.min(1, classes / classDaysInMonth(session, month));
    schedule.push({ month, share, classes });
  }
  return schedule;
}

const cents = (dollars: number) => Math.round(dollars * 100);

/**
 * A monthly payment less the 15% family discount, the cent rounded in the
 * family's favor. Checkout and src/server/family-discount.ts both use it, so
 * the two always agree.
 */
export function familyDiscounted(regularCents: number) {
  const pct = Math.round(PRICING.multiDiscount * 100);
  return regularCents - Math.ceil((regularCents * pct) / 100);
}
/** The 15% off a tuition amount, the cent rounded in the family's favor (as familyDiscounted). */
function familyDiscountOff(tuitionCents: number) {
  return tuitionCents - familyDiscounted(tuitionCents);
}
const money = (c: number) => `$${(c / 100).toFixed(c % 100 === 0 ? 0 : 2)}`;
const monthName = (key: string) => toDate(`${key}-01`).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });

// ───────────── Plans ─────────────

/** One date booked on its own: a drop-in night, the free community class. */
const oneDate = (s: Pick<Session, 'startDate' | 'endDate'>) => s.startDate === s.endDate;

/**
 * A weekly class with tuition, priced by the month or by the session (a block of
 * weeks). These count toward the 15% family discount (decided Oct 13, 2026);
 * drop-in nights (one-date sessions like Geode Adult Improv) and free classes don't.
 */
export function isWeeklyTuitionClass(program: Program, session: Session) {
  const price = session.price ?? program.priceFrom;
  return program.kind === 'class' && !oneDate(session) && !!price && price.amount > 0 && (price.unit === 'month' || price.unit === 'session');
}

/**
 * New students' first class is free in Little Characters weekly classes, priced
 * by the month or by the session (Stories and Songs; decided Oct 13, 2026). Not
 * Geode. The site's "first class free" badges use this same rule.
 */
export function hasFreeFirstClass(program: Program, session?: Session) {
  const price = session?.price ?? program.priceFrom ?? program.sessions.find((s) => s.price)?.price;
  if (program.brand !== 'lc' || program.kind !== 'class' || !price || price.amount <= 0) return false;
  if (session && oneDate(session)) return false;
  return price.unit === 'month' || price.unit === 'session';
}

export function availablePlans(program: Program, session: Session, opts: { newStudents: boolean; full: boolean }): Plan[] {
  if (opts.full) return ['waitlist'];
  const unit = session.price?.unit ?? program.priceFrom?.unit;
  const trial: Plan[] = opts.newStudents && hasFreeFirstClass(program, session) ? ['trial'] : [];
  if (unit === 'month') return [...trial, 'monthly', 'full'];
  if (unit === 'session') return [...trial, 'once'];
  return ['once'];
}

/**
 * The plan the review page starts on: the free first class when it's offered
 * (the home page promises "Nothing is due when you enroll"), otherwise monthly.
 * The other plans stay one tap away.
 */
export function defaultPlan(plans: Plan[]): Plan {
  return plans.includes('trial') ? 'trial' : plans.includes('monthly') ? 'monthly' : plans[0];
}

// ───────────── Quote ─────────────

export function quote(input: QuoteInput): Quote {
  const { program, session, students, plan, today } = input;
  const price = session.price ?? program.priceFrom;
  const lines: QuoteLine[] = [];
  const later: string[] = [];
  const installments: Installment[] = [];
  const notes: string[] = [];

  if (!price || !students.length) {
    return { plan, lines, subtotalCents: 0, discountCents: 0, totalCents: 0, later, installments, notes };
  }

  if (plan === 'waitlist') {
    notes.push('Nothing is due now. We’ll email you if a spot opens up.');
    return { plan, lines, subtotalCents: 0, discountCents: 0, totalCents: 0, later, installments, notes };
  }

  if (plan === 'trial') {
    for (const s of students) lines.push({ kind: 'tuition', label: `${s.firstName}: first class free`, studentId: s.id, amountCents: 0 });
    notes.push(
      price.unit === 'session'
        ? 'Nothing is due today. After the free class, you can stay on and pay for the classes left.'
        : 'Nothing is due today. After the free class, you can continue with monthly tuition or pay for the season.',
    );
    return { plan, lines, subtotalCents: 0, discountCents: 0, totalCents: 0, later, installments, notes };
  }

  if ((price.unit === 'month' || price.unit === 'session') && !meetings(session).some((m) => m >= today)) {
    notes.push('This class has ended.');
    return { plan, lines, subtotalCents: 0, discountCents: 0, totalCents: 0, later, installments, notes };
  }

  // 15% for two or more students or classes; never on a drop-in night (decided Oct 13, 2026).
  const isClass = program.kind === 'class' && !oneDate(session);
  const multi = isClass && price.amount > 0 && input.otherClassEnrollments + students.length >= 2;

  // Tuition
  const tuition: { studentId: string; firstName: string; cents: number; label: string }[] = [];
  if (price.unit === 'month') {
    const schedule = monthlySchedule(session, today);
    if (plan === 'full') {
      const totalShare = schedule.reduce((a, m) => a + m.share, 0);
      for (const s of students) {
        tuition.push({
          studentId: s.id,
          firstName: s.firstName,
          cents: cents(price.amount * totalShare),
          label: `${s.firstName}: ${session.term} tuition (${schedule.length} months, ${classCount(schedule.reduce((a, m) => a + m.classes, 0))})`,
        });
      }
      if (schedule[0].share < 1) notes.push(`${monthName(schedule[0].month)} is prorated to its ${classCount(schedule[0].classes)}.`);
    } else {
      const first = schedule[0];
      for (const s of students) {
        tuition.push({
          studentId: s.id,
          firstName: s.firstName,
          cents: cents(price.amount * first.share),
          label: `${s.firstName}: ${monthName(first.month)} tuition, ${classCount(first.classes)}${first.share < 1 ? ' (prorated)' : ''}`,
        });
      }
      const rest = schedule.slice(1);
      if (rest.length) {
        const perMonth = cents(price.amount) * students.length;
        const perMonthAfterDiscount = multi ? familyDiscounted(perMonth) : perMonth;
        const who = students.map((s) => s.firstName).join(' & ');
        for (const m of rest) {
          installments.push({ dueDate: `${m.month}-01`, amountCents: perMonthAfterDiscount, regularAmountCents: perMonth, label: `${monthName(m.month)} tuition: ${who}, ${program.title}` });
        }
        later.push(
          `Then ${money(perMonthAfterDiscount)} charged automatically to your saved card on the 1st of ${rest.map((m) => monthName(m.month)).join(', ').replace(/, ([^,]*)$/, ' and $1')}.`,
        );
      }
    }
  } else if (price.unit === 'session') {
    const all = meetings(session);
    const remaining = all.filter((m) => m >= today).length;
    const lateJoin = joinedLate(session, today);
    for (const s of students) {
      // Late joiners, and students staying on after their free class, pay for the classes left.
      const prorate = (lateJoin || !!input.trialStudentIds?.includes(s.id)) && remaining < all.length;
      const share = prorate ? remaining / all.length : 1;
      const label = prorate ? `${remaining} of ${all.length} classes, prorated` : classCount(all.length);
      tuition.push({ studentId: s.id, firstName: s.firstName, cents: cents(price.amount * share), label: `${s.firstName}: ${program.title} (${label})` });
    }
  } else if (price.unit === 'child') {
    students.forEach((s, i) => {
      const amount = i === 0 ? price.amount : (price.additional ?? price.amount);
      tuition.push({ studentId: s.id, firstName: s.firstName, cents: cents(amount), label: `${s.firstName}${i > 0 ? ' (additional child)' : ''}` });
    });
  } else {
    for (const s of students) tuition.push({ studentId: s.id, firstName: s.firstName, cents: cents(price.amount), label: `${s.firstName}: ${program.title}` });
  }

  for (const t of tuition) lines.push({ kind: 'tuition', label: t.label, studentId: t.studentId, amountCents: t.cents });

  // Discounts (tuition only)
  const tuitionCents = tuition.reduce((a, t) => a + t.cents, 0);
  if (tuitionCents > 0) {
    const rates: { rate: number; label: string }[] = [];
    if (multi) rates.push({ rate: PRICING.multiDiscount, label: '15% multi-class / multi-student discount' });
    if (plan === 'full' && price.unit === 'month') rates.push({ rate: PRICING.payInFullDiscount, label: '10% pay-in-full discount' });
    if (rates.length) {
      if (PRICING.stackDiscounts) {
        let remaining = tuitionCents;
        for (const r of rates) {
          const off = Math.round(remaining * r.rate);
          remaining -= off;
          lines.push({ kind: 'discount', label: r.label, amountCents: -off });
        }
      } else {
        const best = rates.reduce((a, b) => (b.rate > a.rate ? b : a));
        // The 15% is rounded in the family's favor, the same as on later months (familyDiscounted).
        const off = best.rate === PRICING.multiDiscount ? familyDiscountOff(tuitionCents) : Math.round(tuitionCents * best.rate);
        lines.push({ kind: 'discount', label: best.label, amountCents: -off });
        if (rates.length > 1) notes.push('Discounts don’t combine, so you’re getting the bigger one.');
      }
    }
  }

  // One-time fees
  if (program.fee) {
    for (const s of students) {
      lines.push({ kind: 'fee', label: `${s.firstName}: ${program.fee.label} (one-time)`, studentId: s.id, amountCents: cents(program.fee.amount) });
    }
  }

  const subtotalCents = lines.filter((l) => l.kind !== 'discount').reduce((a, l) => a + l.amountCents, 0);
  const discountCents = lines.filter((l) => l.kind === 'discount').reduce((a, l) => a - l.amountCents, 0);
  return { plan, lines, subtotalCents, discountCents, totalCents: subtotalCents - discountCents, later, installments, notes };
}

export function formatCents(c: number) {
  return money(c);
}

const classCount = (n: number) => `${n} ${n === 1 ? 'class' : 'classes'}`;
const shortDay = (iso: string) => toDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const andList = (items: string[]) => items.join(', ').replace(/, ([^,]*)$/, ' and $1');

// ───────────── What families read ─────────────

/**
 * "$160 for 9 weeks" and "$17.78 a class", for a class priced per session,
 * counted from the session's real meetings ("$160/session" read as $160 a
 * class). Undefined for any other price.
 */
export function sessionPriceParts(price: Price | undefined, session: Pick<Session, 'days' | 'startDate' | 'endDate'> | undefined) {
  if (!price || price.unit !== 'session' || price.amount <= 0 || !session || oneDate(session)) return undefined;
  const n = meetings(session).length;
  if (n < 2) return undefined;
  const span = session.days.length === 1 ? `${n} weeks` : `${n} classes`;
  return { total: `$${price.amount} for ${span}`, perClass: `${money(Math.round((price.amount * 100) / n))} a class` };
}

/** Tuition and fees in a quote, apart. */
function split(q: Quote) {
  const fee = q.lines.filter((l) => l.kind === 'fee').reduce((a, l) => a + l.amountCents, 0);
  return { tuition: q.totalCents - fee, fee };
}
const plusFee = (q: Quote) => {
  const { tuition, fee } = split(q);
  return fee ? `${money(tuition)} + ${money(fee)} fee` : money(tuition);
};

/**
 * "Joining now" on a class page, before any account: what one new student
 * pays today and after, from the same quote checkout uses, so the two always
 * agree. Undefined where it doesn't apply (not a weekly class with tuition,
 * full, or nothing left to join).
 */
export function joiningNow(program: Program, session: Session, today: string): string[] | undefined {
  if (!isWeeklyTuitionClass(program, session) || session.status === 'waitlist' || !meetings(session).some((m) => m >= today)) return undefined;
  const student = { id: 'new', firstName: 'New student' };
  const priced = (plan: Plan) => quote({ program, session, students: [student], plan, otherClassEnrollments: 0, today });
  const plans = availablePlans(program, session, { newStudents: true, full: false });
  const unit = (session.price ?? program.priceFrom)!.unit;
  const lines: string[] = [];
  const or = () => (lines.length ? 'Or ' : '');
  if (plans.includes('trial')) {
    lines.push(
      unit === 'session'
        ? 'Nothing today; the first class is free. If you stay on, you pay only for the classes left.'
        : 'Nothing today; the first class is free.',
    );
  }
  if (plans.includes('monthly')) {
    const m = priced('monthly');
    const later = m.installments.length
      ? `, then ${[...new Set(m.installments.map((i) => i.amountCents))].length === 1 ? money(m.installments[0].amountCents) : 'the monthly tuition'} on ${andList(m.installments.map((i) => shortDay(i.dueDate)))}`
      : '';
    lines.push(`${or()}${plusFee(m)} today${later}.`);
  }
  if (plans.includes('full')) lines.push(`${or()}${plusFee(priced('full'))} for the rest of the season.`);
  if (plans.includes('once')) {
    const o = priced('once');
    const n = meetings(session).filter((m) => m >= today).length;
    const all = meetings(session).length;
    lines.push(`${or()}${plusFee(o)} today for ${n === all ? `all ${all} classes` : `the ${n} classes left`}.`);
  }
  return lines;
}

/**
 * What a plan says on the review page. The season-in-full line names the
 * discount actually applied, and says so when paying up front saves nothing
 * over paying monthly (the 15% family discount and the 10% don't combine).
 */
export function planCopy(plan: Plan, q: Quote, monthly?: Quote): { title: string; body: string } {
  const t = money(q.totalCents);
  switch (plan) {
    case 'trial':
      return { title: 'Try the first class free', body: 'Nothing due today. Decide after the class.' };
    case 'monthly':
      return { title: 'Pay monthly', body: `${t} today, then charged automatically on the 1st of each month.` };
    case 'once':
      return { title: 'Pay now', body: `${t} today.` };
    case 'waitlist':
      return { title: 'Join the waitlist', body: 'Nothing due now. We’ll email you if a spot opens.' };
    case 'full': {
      const discount = q.lines.find((l) => l.kind === 'discount');
      const named = !discount ? '' : /15%/.test(discount.label) ? ' with the 15% family discount' : ', 10% off';
      let saving = '';
      if (monthly) {
        const monthlyTotal = monthly.totalCents + monthly.installments.reduce((a, i) => a + i.amountCents, 0);
        const saves = monthlyTotal - q.totalCents;
        saving = saves >= 100 ? ` You save ${money(saves)} over paying monthly.` : ' It’s the same total as paying monthly.';
      }
      return { title: 'Pay for the season in full', body: `${t} today${named}, and you’re done.${saving}` };
    }
  }
}
