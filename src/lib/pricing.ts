/**
 * Pricing engine: turns a program, a session, the chosen students and a
 * payment plan into order lines. Pure functions, no database, so every rule
 * is unit-tested (tests/pricing.test.ts).
 *
 * Rules come from the Fall 2026 tuition guidelines:
 *  - Monthly classes: the first month is due at registration; the rest on the
 *    1st of each month. Joining after the first week prorates the first month.
 *  - Pay the semester in full: 10% off.
 *  - Multi-class or multi-student families: 15% off tuition.
 *  - Discounts don't stack; each line gets the best one (PRICING.stackDiscounts).
 *  - One-time performance/materials fee per student.
 *  - New students' first class is free (a "trial": nothing due today).
 *  - Parents' Night Out: first child full price, each additional child less.
 */
import type { Program, Session, Weekday } from '@/data/types';

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

export interface Quote {
  plan: Plan;
  lines: QuoteLine[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  /** What comes after today's payment, e.g. "4 more monthly payments of $95". */
  later: string[];
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

/**
 * Monthly billing schedule from today (or the first class) to the end of the term.
 * Each entry is the share of that month's tuition owed (1 = full month).
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

  const lateJoin = toDate(today).getTime() - toDate(session.startDate).getTime() > PRICING.prorateAfterDays * 86_400_000;
  const schedule: { month: string; share: number }[] = [];
  for (const [month, e] of byMonth) {
    if (e.remaining === 0) continue;
    const isFirst = schedule.length === 0;
    const share = isFirst && lateJoin ? e.remaining / e.total : 1;
    schedule.push({ month, share });
  }
  return schedule;
}

const cents = (dollars: number) => Math.round(dollars * 100);
const money = (c: number) => `$${(c / 100).toFixed(c % 100 === 0 ? 0 : 2)}`;
const monthName = (key: string) => toDate(`${key}-01`).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });

// ───────────── Plans ─────────────

export function availablePlans(program: Program, session: Session, opts: { newStudents: boolean; full: boolean }): Plan[] {
  if (opts.full) return ['waitlist'];
  const unit = session.price?.unit ?? program.priceFrom?.unit;
  if (unit === 'month') {
    const plans: Plan[] = [];
    if (opts.newStudents && program.brand === 'lc' && program.kind === 'class') plans.push('trial');
    plans.push('monthly', 'full');
    return plans;
  }
  return ['once'];
}

// ───────────── Quote ─────────────

export function quote(input: QuoteInput): Quote {
  const { program, session, students, plan, today } = input;
  const price = session.price ?? program.priceFrom;
  const lines: QuoteLine[] = [];
  const later: string[] = [];
  const notes: string[] = [];

  if (!price || !students.length) {
    return { plan, lines, subtotalCents: 0, discountCents: 0, totalCents: 0, later, notes };
  }

  if (plan === 'waitlist') {
    notes.push('Nothing is due now. We’ll email you if a spot opens up.');
    return { plan, lines, subtotalCents: 0, discountCents: 0, totalCents: 0, later, notes };
  }

  if (plan === 'trial') {
    for (const s of students) lines.push({ kind: 'tuition', label: `${s.firstName}: first class free`, studentId: s.id, amountCents: 0 });
    notes.push('Nothing is due today. After the free class, you can continue with monthly tuition or pay for the semester.');
    return { plan, lines, subtotalCents: 0, discountCents: 0, totalCents: 0, later, notes };
  }

  const isClass = program.kind === 'class';
  const multi = isClass && price.amount > 0 && input.otherClassEnrollments + students.length >= 2;

  // Tuition
  const tuition: { studentId: string; firstName: string; cents: number; label: string }[] = [];
  if (price.unit === 'month') {
    const schedule = monthlySchedule(session, today);
    if (!schedule.length) {
      notes.push('This class has ended.');
    } else if (plan === 'full') {
      const totalShare = schedule.reduce((a, m) => a + m.share, 0);
      for (const s of students) {
        tuition.push({ studentId: s.id, firstName: s.firstName, cents: cents(price.amount * totalShare), label: `${s.firstName}: ${session.term} tuition (${schedule.length} months)` });
      }
      if (schedule[0].share < 1) notes.push(`${monthName(schedule[0].month)} is prorated because the term has already started.`);
    } else {
      const first = schedule[0];
      for (const s of students) {
        tuition.push({
          studentId: s.id,
          firstName: s.firstName,
          cents: cents(price.amount * first.share),
          label: `${s.firstName}: ${monthName(first.month)} tuition${first.share < 1 ? ' (prorated)' : ''}`,
        });
      }
      const rest = schedule.length - 1;
      if (rest > 0) {
        const perMonth = cents(price.amount) * students.length;
        const perMonthAfterDiscount = multi ? Math.round(perMonth * (1 - PRICING.multiDiscount)) : perMonth;
        later.push(`${rest} more monthly payment${rest > 1 ? 's' : ''} of ${money(perMonthAfterDiscount)}, due on the 1st (${schedule.slice(1).map((m) => monthName(m.month)).join(', ')}).`);
      }
    }
  } else if (price.unit === 'session') {
    const all = meetings(session);
    const remaining = all.filter((m) => m >= today).length;
    const lateJoin = toDate(today).getTime() - toDate(session.startDate).getTime() > PRICING.prorateAfterDays * 86_400_000;
    const share = lateJoin && all.length ? remaining / all.length : 1;
    for (const s of students) {
      tuition.push({ studentId: s.id, firstName: s.firstName, cents: cents(price.amount * share), label: `${s.firstName}: ${program.title}${share < 1 ? ' (prorated)' : ''}` });
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
        lines.push({ kind: 'discount', label: best.label, amountCents: -Math.round(tuitionCents * best.rate) });
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
  const discountCents = -lines.filter((l) => l.kind === 'discount').reduce((a, l) => a + l.amountCents, 0);
  return { plan, lines, subtotalCents, discountCents, totalCents: subtotalCents - discountCents, later, notes };
}

export function formatCents(c: number) {
  return money(c);
}
