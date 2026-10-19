/**
 * The reports library (docs/back-office.md → Reports): every report's key,
 * the question it answers, its Studio Director name, how it's counted, which
 * filters it takes, and the one function that runs it.
 *
 * The dashboard runs these same reports with the same filters and shows
 * their totals (dashboard.ts), so a tile and the table behind it can't
 * disagree. Reports only read.
 */
import { getSetting, type Baseline } from '../settings-store';
import type { ClassRow } from '../classes';
import { lastSeason, thisSeason, type ReportContext, type ReportFilters, type ReportResult } from './common';
import { childrenFrom, classesFrom, comingBackFrom, dropsFrom, freeClassFrom, loadClassRows, loadEnrollments, atRiskFrom, signupsByWeekFrom, waitlistsFrom, type EnrollData } from './enrollment';
import { heardAboutFrom, loadFamilies, newFamiliesFrom, zipFrom, type FamilyRow } from './growth';
import { chargesFrom, classPaymentsFrom, discountsFrom, dropInsFrom, loadMoney, moneyByMonthFrom, nextChargeDayReport, paymentsReceivedReport, refundsFrom, upcomingReport, whoOwesReport, type MoneyData } from './money';
import { absencesFrom, allergyList, attendanceTakenFrom, careFrom, loadCare, loadMarks, loadTaken, missedTwoReport, photoPermission, type CareRow, type MarkRow } from './safety';
import { loadTeacherAttendance, loadTeacherLinks, teacherAttendanceFrom, teacherClassesFrom } from './teachers';

export type ReportGroup = 'money' | 'enrollment' | 'growth' | 'safety' | 'teachers';
export const GROUPS: { key: ReportGroup; title: string }[] = [
  { key: 'money', title: 'Money' },
  { key: 'enrollment', title: 'Classes and enrollment' },
  { key: 'growth', title: 'Families and growth' },
  { key: 'safety', title: 'Safety and attendance' },
  { key: 'teachers', title: 'Teachers' },
];

export type FilterKey = 'season' | 'month' | 'program' | 'location' | 'class' | 'show' | 'week' | 'who';

/**
 * The data the reports load, each at most once per request: the dashboard
 * runs a dozen reports over the same few loads.
 */
export class Loads {
  private memo = new Map<string, Promise<unknown>>();
  constructor(readonly ctx: ReportContext) {}
  private once<T>(key: string, load: () => Promise<T>): Promise<T> {
    if (!this.memo.has(key)) this.memo.set(key, load());
    return this.memo.get(key) as Promise<T>;
  }
  money = () => this.once<MoneyData>('money', loadMoney);
  enrollments = () => this.once<EnrollData>('enrollments', loadEnrollments);
  classes = () => this.once<ClassRow[]>('classes', () => loadClassRows(this.ctx));
  families = () => this.once<FamilyRow[]>('families', loadFamilies);
  care = () => this.once<CareRow[]>('care', loadCare);
  marks = () => this.once<MarkRow[]>('marks', loadMarks);
  baseline = () => this.once<Baseline | null>('baseline', () => getSetting('reports.baseline'));
  /** "This season" and "last season" (common.ts). */
  seasons() {
    const current = thisSeason(this.ctx.content.programs, this.ctx.today);
    return { current, last: lastSeason(this.ctx.content.programs, current) };
  }
}

export interface RunInput {
  loads: Loads;
  f: ReportFilters;
  /** The season the report counts: the filter, or this season. Null when there's none (or "all" was picked). */
  season: string | null;
  viewerId: string;
}

export interface ReportDef {
  key: string;
  group: ReportGroup;
  /** The question it answers: the page's title. */
  title: string;
  /** Studio Director's name for it, so Hannah finds the familiar one. */
  was?: string;
  /** "How it's counted", in one plain sentence. */
  how: string;
  filters: FilterKey[];
  /** Offer "All seasons" as well as each season. */
  allSeasons?: boolean;
  /** The table names children: viewing it is written to the audit log. */
  namesChildren?: boolean;
  /** Shows care details: a fresh sign-in first. */
  fresh?: boolean;
  run(input: RunInput): Promise<ReportResult>;
}

const ctxOf = (i: RunInput) => i.loads.ctx;

export const REPORTS: ReportDef[] = [
  // ───────────── Money ─────────────
  {
    key: 'payments-received',
    group: 'money',
    title: 'What came in this month?',
    was: 'Payment Summary, Payment List, Deposit Summary',
    how: 'Payments received this month, all programs, less refunds.',
    filters: ['month', 'program', 'location'],
    run: (i) => paymentsReceivedReport(ctxOf(i), i.f),
  },
  {
    key: 'money-by-month',
    group: 'money',
    title: 'What came in each month?',
    was: 'Payment Summary, Deposit Summary',
    how: 'Payments received each month for the last 12 months, all programs, less refunds, beside last year’s months typed in from Studio Director.',
    filters: [],
    run: async (i) => moneyByMonthFrom(await i.loads.money(), ctxOf(i).today.slice(0, 7), await i.loads.baseline()),
  },
  {
    key: 'next-charge-day',
    group: 'money',
    title: 'What’s booked for the next 1st?',
    how: 'Monthly charges scheduled for the next billing day.',
    filters: ['program', 'location'],
    run: (i) => nextChargeDayReport(ctxOf(i), i.f),
  },
  {
    key: 'upcoming-autopay',
    group: 'money',
    title: 'What’s committed ahead?',
    how: 'Charges scheduled for the next 90 days.',
    filters: ['program', 'location'],
    run: (i) => upcomingReport(ctxOf(i), i.f),
  },
  {
    key: 'who-owes',
    group: 'money',
    title: 'Who owes, and for how long?',
    was: 'Overdue List, Aging / Collections List',
    how: 'Failed or overdue charges, how many and the total, by days since they were due (0–30, 31–60, 61–90, 90+).',
    filters: ['program', 'location'],
    run: (i) => whoOwesReport(ctxOf(i), i.f),
  },
  {
    key: 'charges',
    group: 'money',
    title: 'What did we charge, by type and season?',
    was: 'Charges Summary, Charges List, Season Charges Trend',
    how: 'Paid sign-ups (tuition after the family and season discounts, and fees), paid drop-ins, and monthly charges due by today with their late fees; charges staff stopped aren’t counted.',
    filters: ['season', 'program', 'location'],
    allSeasons: true,
    run: async (i) => chargesFrom(await i.loads.money(), ctxOf(i).content, ctxOf(i).today, { ...i.f, season: i.season ?? undefined }),
  },
  {
    key: 'class-payments',
    group: 'money',
    title: 'What was charged and paid for each class?',
    was: 'Class Payments Summary, Charges/Payments Summary',
    how: 'For each class: what was charged so far, what was paid, refunds, what’s overdue and what autopay will still charge.',
    filters: ['season', 'program', 'location'],
    allSeasons: true,
    run: async (i) => classPaymentsFrom(await i.loads.money(), ctxOf(i).content, ctxOf(i).today, { ...i.f, season: i.season ?? undefined }),
  },
  {
    key: 'discounts',
    group: 'money',
    title: 'What discounts did we give?',
    was: 'Payment Plans/Promos',
    how: 'The family 15%, the season 10%, staff discounts, days off, credits and free first classes this season, as a share of full price.',
    filters: ['season', 'program', 'location'],
    run: async (i) => discountsFrom(await i.loads.money(), ctxOf(i).content, { ...i.f, season: i.season ?? undefined }),
  },
  {
    key: 'refunds',
    group: 'money',
    title: 'What did we refund?',
    how: 'Refunds made by card or by cash or check, done or still with the bank, for the season’s classes.',
    filters: ['season', 'month', 'program', 'location'],
    allSeasons: true,
    run: async (i) => refundsFrom(await i.loads.money(), ctxOf(i).content, { ...i.f, season: i.season ?? undefined }),
  },
  {
    key: 'drop-ins',
    group: 'money',
    title: 'How many drop-ins, by month and class?',
    was: 'Student Make-ups/Trials/Drop-ins',
    how: 'Drop-ins booked (paid or added without charge) by the month of the class date, and what was paid for them.',
    filters: ['season', 'month', 'program', 'location'],
    allSeasons: true,
    run: async (i) => dropInsFrom(await i.loads.money(), ctxOf(i).content, { ...i.f, season: i.season ?? undefined }),
  },

  // ───────────── Classes and enrollment ─────────────
  {
    key: 'classes',
    group: 'enrollment',
    title: 'How full are our classes?',
    was: 'Class List',
    how: 'Enrolled ÷ places, per class and overall; enrolled includes free first classes, and classes with no limit have no rate.',
    filters: ['season', 'program', 'location'],
    run: async (i) => classesFrom(await i.loads.classes(), i.season, i.f),
  },
  {
    key: 'children',
    group: 'enrollment',
    title: 'Which children are in a class this season?',
    was: 'Student List',
    how: 'Each child with an active enrollment this season (or a free first class), counted once.',
    filters: ['season', 'program', 'location'],
    namesChildren: true,
    run: async (i) => childrenFrom(await i.loads.enrollments(), ctxOf(i).content, i.season, i.f),
  },
  {
    key: 'signups-by-week',
    group: 'enrollment',
    title: 'How fast are families signing up?',
    how: 'Sign-ups per week this season, beside last season, counted from each season’s first class.',
    filters: ['season', 'program', 'location'],
    run: async (i) => {
      const { current, last } = i.loads.seasons();
      const prior = i.season === current ? last : null;
      return signupsByWeekFrom(await i.loads.enrollments(), ctxOf(i).content, i.season, prior, ctxOf(i).today, i.f);
    },
  },
  {
    key: 'at-risk',
    group: 'enrollment',
    title: 'Which classes might not run?',
    how: 'Weekly classes under the 5 students a class needs, from two weeks before they start to two weeks in.',
    filters: ['program', 'location'],
    run: async (i) => atRiskFrom(await i.loads.classes(), ctxOf(i).today, i.f),
  },
  {
    key: 'waitlists',
    group: 'enrollment',
    title: 'Who’s waiting for a place?',
    how: 'Children waiting, per class, in classes that haven’t ended.',
    filters: ['program', 'location'],
    run: async (i) => waitlistsFrom(await i.loads.classes(), i.f),
  },
  {
    key: 'drops',
    group: 'enrollment',
    title: 'Who dropped, and why?',
    was: 'Drop Summary, Class Drop History, Student Drop History',
    how: 'Children taken off a class, by class and the reason staff picked; older drops have no date or reason.',
    filters: ['season', 'program', 'location'],
    allSeasons: true,
    run: async (i) => dropsFrom(await i.loads.enrollments(), ctxOf(i).content, { ...i.f, season: i.season ?? undefined }),
  },
  {
    key: 'free-class',
    group: 'enrollment',
    title: 'Did free-class families stay on?',
    was: 'Student Trials',
    how: 'Children who had a free first class this season, and how many then signed up and paid.',
    filters: ['season', 'program', 'location'],
    namesChildren: true,
    run: async (i) => freeClassFrom(await i.loads.enrollments(), ctxOf(i).content, i.season, i.f),
  },
  {
    key: 'coming-back',
    group: 'enrollment',
    title: 'Who came back from last season?',
    was: 'Retention List, Students Not Returning',
    how: 'Last season’s children enrolled again this season, with the list of who isn’t back yet.',
    filters: ['program', 'location'],
    namesChildren: true,
    run: async (i) => {
      const { current, last } = i.loads.seasons();
      return comingBackFrom(await i.loads.enrollments(), ctxOf(i).content, current, last, await i.loads.baseline(), i.f);
    },
  },

  // ───────────── Families and growth ─────────────
  {
    key: 'heard-about',
    group: 'growth',
    title: 'How did new families find us?',
    was: 'How Families Heard About Us Metrics',
    how: 'New families this season (their first sign-up, not families brought over from Studio Director) by their answer to “How did you hear about us?”.',
    filters: ['season', 'who', 'program', 'location'],
    run: async (i) => heardAboutFrom(await i.loads.families(), (await i.loads.enrollments()).enrollments, ctxOf(i).content, i.season, i.f),
  },
  {
    key: 'zip-codes',
    group: 'growth',
    title: 'Where do our families live?',
    was: 'Family ZIP Codes',
    how: 'New families this season (or every family with a class this season) by ZIP code, most first.',
    filters: ['season', 'who', 'program', 'location'],
    run: async (i) => zipFrom(await i.loads.families(), (await i.loads.enrollments()).enrollments, ctxOf(i).content, i.season, i.f),
  },
  {
    key: 'new-families',
    group: 'growth',
    title: 'How many new families each month?',
    how: 'Families by the month of their first sign-up, the last 12 months, not counting families brought over from Studio Director.',
    filters: [],
    run: async (i) => newFamiliesFrom(await i.loads.families(), (await i.loads.enrollments()).enrollments, ctxOf(i).today),
  },

  // ───────────── Safety and attendance ─────────────
  {
    key: 'care-details',
    group: 'safety',
    title: 'Do we have every child’s care details?',
    how: 'Children in a current class whose care details a parent confirmed in the past year, with an emergency contact and a pickup list.',
    filters: ['program', 'location', 'class'],
    namesChildren: true,
    run: async (i) => careFrom(await i.loads.care(), ctxOf(i).content, ctxOf(i).today, ctxOf(i).now, i.f),
  },
  {
    key: 'missed-two',
    group: 'safety',
    title: 'Who missed two classes in a row?',
    was: 'Student Absence',
    how: 'Children absent from their last two classes, in classes that haven’t ended.',
    filters: ['program', 'location', 'class'],
    namesChildren: true,
    run: (i) => missedTwoReport(ctxOf(i), i.f),
  },
  {
    key: 'attendance-taken',
    group: 'safety',
    title: 'Was attendance taken this week?',
    was: 'Class Attendance',
    how: 'This week’s classes with attendance done, out of the ones that have met (not days off, and only classes with children).',
    filters: ['week', 'program', 'location'],
    run: async (i) => {
      const classes = await i.loads.classes();
      const week = i.f.week ?? ctxOf(i).today;
      return attendanceTakenFrom(await loadTaken(classes, week), week, ctxOf(i).now, ctxOf(i).today, i.f);
    },
  },
  {
    key: 'absences',
    group: 'safety',
    title: 'Who was absent, and why?',
    was: 'Student Absence, Class Attendance',
    how: 'Every absence marked this season, by class and child, with the reason when the teacher picked one.',
    filters: ['season', 'program', 'location', 'class'],
    namesChildren: true,
    run: async (i) => absencesFrom(await i.loads.marks(), ctxOf(i).content, i.season, i.f),
  },
  {
    key: 'allergies',
    group: 'safety',
    title: 'Which children in a class have allergies or medical notes?',
    how: 'Every child enrolled in the class, with the allergies and medical notes their parents gave us.',
    filters: ['class'],
    namesChildren: true,
    fresh: true,
    run: (i) => allergyList(ctxOf(i), i.f, i.viewerId),
  },
  {
    key: 'photo-permission',
    group: 'safety',
    title: 'Who can be in photos?',
    how: 'Each child’s photo permission from their family, for a class, a show’s cast, or every current class.',
    filters: ['class', 'show'],
    namesChildren: true,
    run: (i) => photoPermission(ctxOf(i), i.f),
  },

  // ───────────── Teachers ─────────────
  {
    key: 'teacher-classes',
    group: 'teachers',
    title: 'Who teaches what, and when?',
    was: 'Instructor List, Instructor Work Schedule',
    how: 'Each class this season under its teachers from Settings → Staff (or the teacher named on the site), with its days and times.',
    filters: ['season', 'program', 'location'],
    run: async (i) => teacherClassesFrom(await i.loads.classes(), await loadTeacherLinks(), i.season, i.f),
  },
  {
    key: 'teacher-attendance',
    group: 'teachers',
    title: 'Are teachers taking attendance?',
    was: 'Instructor / Class Attendance',
    how: 'For each teacher, the class dates so far this season that needed attendance, and how many were taken.',
    filters: ['season', 'program', 'location'],
    run: async (i) => {
      const classes = await i.loads.classes();
      const c = ctxOf(i);
      return teacherAttendanceFrom(await loadTeacherAttendance(classes, c.content, i.season, c.today), i.season, c.today, c.now, i.f);
    },
  },
];

export const findReport = (key: string) => REPORTS.find((r) => r.key === key);

/** The season a report counts: the filter ("all" = every season, where offered), else this season. */
export function seasonFor(def: ReportDef, f: ReportFilters, loads: Loads) {
  if (!def.filters.includes('season')) return loads.seasons().current;
  if (f.season === 'all') return def.allSeasons ? null : loads.seasons().current;
  return f.season ?? loads.seasons().current;
}

/** Run one report with its filters. The dashboard and the report page both come through here. */
export function runReport(def: ReportDef, f: ReportFilters, loads: Loads, viewerId: string) {
  return def.run({ loads, f, season: seasonFor(def, f, loads), viewerId });
}

/** Reports elsewhere on the staff pages, linked rather than copied. */
export const ELSEWHERE: { title: string; was: string; where: 'classes' | 'families' | 'payments' | 'shows' | 'calendar' | 'leads' }[] = [
  { title: 'A class’s roster, to print or download', was: 'Class Roster', where: 'classes' },
  { title: 'A class’s sign-in sheet', was: 'Student Sign-in Sheets', where: 'classes' },
  { title: 'A class’s skills worksheet', was: 'Class Skills Worksheet', where: 'classes' },
  { title: 'Families, children and contact lists', was: 'Family List, Student / Class List, Student Contact List', where: 'families' },
  { title: 'Payments, overdue and upcoming autopay lists', was: 'Payments List, Overdue List', where: 'payments' },
  { title: 'Cast lists and the program list', was: 'Event Cast Summary, Event Program', where: 'shows' },
  { title: 'Class schedules by day and by class', was: 'Class Schedule, Daily Class Schedule', where: 'calendar' },
  { title: 'Messages and sign-ups from the site', was: 'Leads', where: 'leads' },
];
