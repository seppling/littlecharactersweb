/**
 * Made-up families and a term of made-up activity for the Render preview
 * (docs/plans/preview-demo-data.md). `npm run db:prepare-preview` runs it once
 * on the fresh demo database; nothing else does, and it never runs against a
 * real database.
 *
 * Everything goes through the site's own code: sign-up and checkout with a
 * test payment, the billing run, attendance taps, days off, refunds, credits,
 * tags, skills and shows. A story of dated events is played in order on a
 * clock moved forward from early August to `until`: the caller passes
 * `setNow`, which sets "now" for the whole process (`fakeClock` below for the
 * build, `vi.setSystemTime` in the test). The embedded database's clock
 * follows it, so `created_at` and `paid_at` read like a term of use. The clock
 * only ever moves forward: moving it back confuses the database's timers.
 *
 * Every name is made up, every email is @example.com and every phone number is
 * a 555 number. Sign in at /admin as owner@example.com (Hannah's view),
 * teacher@example.com or teacher2@example.com (the teacher app), or at
 * /account as parent@example.com; the codes are at /dev/mailbox.
 */
import { and, eq } from 'drizzle-orm';
import type { Session } from '../src/content/types';
import { familyDetailsInput } from '../src/lib/family-details';
import { meetings, todayInAthens } from '../src/lib/pricing';
import { addAdjustment, type StaffUser } from '../src/server/adjustments';
import { expectedOn, saveReports, saveTaps, type Viewer } from '../src/server/attendance';
import { addDays, runBilling, markPaidOutsideStripe, waiveLateFee, type Charger } from '../src/server/billing';
import { classDates } from '../src/server/class-day';
import { getCatalog } from '../src/server/content';
import { addCredit } from '../src/server/credits';
import { giveDayOffCredits } from '../src/server/day-off-credits';
import { addDayOff } from '../src/server/days-off';
import { getDb, schema } from '../src/server/db';
import { readyDropIn, startDropIn } from '../src/server/drop-ins';
import { confirmOrder, createDraftOrder, createStudent, ensureHousehold, fulfillOrder, updateFamilyDetails, updateStudentDetails } from '../src/server/family';
import { leadInput, saveLead } from '../src/server/leads';
import { saveTeacherDraft } from '../src/server/progress-notes';
import { createRefund } from '../src/server/refunds';
import { removeChild } from '../src/server/roster-changes';
import { setSetting } from '../src/server/settings-store';
import { addRehearsal, addToCast, athensInstant } from '../src/server/shows';
import { addSkill, setSkill } from '../src/server/skills';
import { addStaff, setClasses } from '../src/server/staff-settings';
import { findOrCreateTag, tagHousehold, tagStudents } from '../src/server/tags';

type Catalog = Awaited<ReturnType<typeof getCatalog>>;
type Plan = 'monthly' | 'full' | 'trial' | 'once' | 'waitlist';

// ───────────── The classes in the story (Fall 2026, src/content/seed/programs.ts) ─────────────

const INTRO = 'intro-f26-tue';
const YESAND = 'yesand-f26-wed';
const PRODUCE = 'produce-f26-mon';
const TROUPE = 'troupe-f26-wed';
const FILM = 'film-f26-thu';
const STORIES = 'stories-songs-f26';
const ACTING = 'acting-studio-f26';
const HOMESCHOOL = 'homeschool-f26';
const PNO = 'pno-2026-09-25';
const SHOW = 'fall-variety-show';

/** Who teaches what: the first teacher is teacher@example.com. */
const TEACHING: Record<string, ['lead' | 'assistant', number][]> = {
  [INTRO]: [['lead', 0]],
  [YESAND]: [['lead', 0]],
  [STORIES]: [['lead', 0]],
  [PRODUCE]: [['lead', 1], ['assistant', 0]],
  [TROUPE]: [['lead', 1]],
  [FILM]: [['lead', 1]],
  [ACTING]: [['lead', 1]],
  [HOMESCHOOL]: [['lead', 1]],
};

// ───────────── The people (all made up) ─────────────

const OWNER = { email: 'owner@example.com', name: 'Pat Rivers' };
const TEACHERS = [
  { email: 'teacher@example.com', name: 'Rory Avalon' },
  { email: 'teacher2@example.com', name: 'Jo Marsh' },
];

interface Signup {
  session: string;
  plan: Plan;
  /** Day it was made, YYYY-MM-DD. */
  on: string;
  /** A free first class that went on to monthly, on this day. */
  continues?: string;
  /** Taken off the class after the free class, with the reason Hannah picked. */
  leaves?: { on: string; reason: string };
}
interface Child {
  first: string;
  age: number;
  allergies?: string;
  medical?: string;
  photo?: boolean;
  classes: Signup[];
}
interface Family {
  last: string;
  parent: string;
  email?: string;
  /** A second parent on the account. */
  second?: string;
  zip: string;
  heard: string;
  /** No care details yet: shows on "Care details on file". */
  noDetails?: boolean;
  kids: Child[];
}

const s = (session: string, on: string, plan: Plan = 'monthly', more: Partial<Signup> = {}): Signup => ({ session, plan, on, ...more });

export const FAMILIES: Family[] = [
  { last: 'Rivera', parent: 'Dana', email: 'parent@example.com', second: 'Luis', zip: '30606', heard: 'friend', kids: [{ first: 'Mia', age: 8, photo: true, classes: [s(INTRO, '2026-08-03')] }, { first: 'Leo', age: 5, classes: [s(STORIES, '2026-10-02', 'once')] }] },
  { last: 'Okafor', parent: 'Chidi', zip: '30605', heard: 'search', kids: [{ first: 'Ada', age: 9, allergies: 'Peanuts (carries an EpiPen in her backpack)', classes: [s(INTRO, '2026-08-03'), s(YESAND, '2026-08-04')] }] },
  { last: 'Chen', parent: 'Wei', zip: '30606', heard: 'social', kids: [{ first: 'Ben', age: 7, classes: [s(INTRO, '2026-08-04')] }] },
  { last: 'Patel', parent: 'Priya', second: 'Arjun', zip: '30677', heard: 'school', kids: [{ first: 'Isha', age: 10, classes: [s(INTRO, '2026-08-04')] }, { first: 'Dev', age: 12, classes: [s(TROUPE, '2026-08-05')] }] },
  { last: 'Johnson', parent: 'Kara', zip: '30601', heard: 'flyer', kids: [{ first: 'Ruby', age: 8, classes: [s(INTRO, '2026-08-05')] }] },
  { last: 'Nguyen', parent: 'Linh', zip: '30605', heard: 'friend', kids: [{ first: 'Kai', age: 9, medical: 'Asthma: inhaler in the front pocket of his bag', classes: [s(INTRO, '2026-08-05')] }] },
  { last: 'Garcia', parent: 'Elena', zip: '30607', heard: 'event', kids: [{ first: 'Sofia', age: 7, classes: [s(INTRO, '2026-08-06')] }, { first: 'Mateo', age: 12, classes: [s(ACTING, '2026-10-05')] }] },
  { last: 'Thompson', parent: 'Grace', zip: '30606', heard: 'search', kids: [{ first: 'Ella', age: 10, photo: false, classes: [s(INTRO, '2026-08-06', 'full'), s(FILM, '2026-08-07')] }] },
  { last: 'Kim', parent: 'Min', zip: '30605', heard: 'social', kids: [{ first: 'Jun', age: 8, classes: [s(INTRO, '2026-08-07')] }] },
  { last: 'Brooks', parent: 'Tasha', zip: '30601', heard: 'event', kids: [{ first: 'Ava', age: 7, classes: [s(INTRO, '2026-08-11', 'trial', { continues: '2026-08-19' })] }] },
  { last: 'Martinez', parent: 'Rosa', zip: '30607', heard: 'friend', kids: [{ first: 'Lucas', age: 9, classes: [s(INTRO, '2026-08-12', 'trial', { continues: '2026-08-20' })] }] },
  { last: 'Walker', parent: 'Jamie', zip: '30601', heard: 'school', kids: [{ first: 'Zoe', age: 8, classes: [s(INTRO, '2026-08-07')] }] },
  { last: 'Hughes', parent: 'Morgan', zip: '30622', heard: 'flyer', kids: [{ first: 'Nora', age: 10, classes: [s(INTRO, '2026-08-08')] }] },
  { last: 'Foster', parent: 'Alex', zip: '30606', heard: 'search', kids: [{ first: 'Owen', age: 7, classes: [s(INTRO, '2026-08-08')] }] },
  { last: 'Bennett', parent: 'Claire', second: 'Sam', zip: '30605', heard: 'friend', kids: [{ first: 'Lily', age: 9, classes: [s(INTRO, '2026-08-09')] }, { first: 'Max', age: 13, classes: [s(PRODUCE, '2026-08-09')] }] },
  { last: 'Reyes', parent: 'Marco', zip: '30683', heard: 'social', kids: [{ first: 'Gabe', age: 8, classes: [s(INTRO, '2026-08-09')] }] },
  { last: 'Sullivan', parent: 'Erin', zip: '30606', heard: 'event', kids: [{ first: 'Iris', age: 10, classes: [s(INTRO, '2026-08-10'), s(FILM, '2026-08-10')] }] },
  { last: 'Ward', parent: 'Toby', zip: '30607', heard: 'flyer', kids: [{ first: 'Theo', age: 7, classes: [s(INTRO, '2026-08-10')] }] },
  { last: 'Price', parent: 'Nina', zip: '30605', heard: 'search', kids: [{ first: 'Maya', age: 9, allergies: 'Dairy', classes: [s(INTRO, '2026-08-12')] }] },
  { last: 'Coleman', parent: 'Drew', zip: '30677', heard: 'school', kids: [{ first: 'Eli', age: 8, classes: [s(INTRO, '2026-08-13')] }] },
  { last: 'Diaz', parent: 'Carmen', zip: '30601', heard: 'friend', kids: [{ first: 'Rosa', age: 10, classes: [s(INTRO, '2026-08-15', 'waitlist')] }] },
  { last: 'Fischer', parent: 'Anke', zip: '30606', heard: 'search', kids: [{ first: 'Hana', age: 8, classes: [s(YESAND, '2026-08-06'), s(INTRO, '2026-08-16', 'waitlist')] }] },
  { last: 'Long', parent: 'Avery', zip: '30605', heard: 'social', kids: [{ first: 'Sam', age: 12, classes: [s(YESAND, '2026-08-08'), s(TROUPE, '2026-08-08')] }] },
  { last: 'Howard', parent: 'Robin', second: 'Lee', zip: '30622', heard: 'event', kids: [{ first: 'Quinn', age: 14, classes: [s(PRODUCE, '2026-08-11'), s(ACTING, '2026-10-08')] }, { first: 'Wren', age: 11, classes: [s(YESAND, '2026-08-11')] }] },
  { last: 'Murphy', parent: 'Kelly', zip: '30607', heard: 'friend', kids: [{ first: 'June', age: 13, classes: [s(FILM, '2026-08-12'), s(ACTING, '2026-10-12')] }] },
  { last: 'Parker', parent: 'Jordan', zip: '30606', heard: 'school', kids: [{ first: 'Cal', age: 15, classes: [s(TROUPE, '2026-08-13'), s(PRODUCE, '2026-08-13')] }] },
  { last: 'Ross', parent: 'Taylor', second: 'Chris', zip: '30605', heard: 'flyer', kids: [{ first: 'Ivy', age: 6, classes: [s(STORIES, '2026-10-06', 'once')] }, { first: 'Finn', age: 9, classes: [s(HOMESCHOOL, '2026-09-03', 'once')] }] },
  { last: 'Gray', parent: 'Shannon', zip: '30683', heard: 'social', kids: [{ first: 'Noah', age: 5, classes: [s(PNO, '2026-09-15', 'once'), s(STORIES, '2026-10-09', 'once')] }] },
  { last: 'Bell', parent: 'Harper', zip: '30601', heard: 'search', kids: [{ first: 'Tess', age: 10, classes: [s(YESAND, '2026-09-01', 'trial', { leaves: { on: '2026-09-10', reason: 'Schedule' } }), s(HOMESCHOOL, '2026-09-04', 'once'), s(PNO, '2026-09-16', 'once')] }] },
  { last: 'Cruz', parent: 'Dani', zip: '30607', heard: 'other: saw the summer camp sign', noDetails: true, kids: [{ first: 'Leah', age: 8, classes: [s(YESAND, '2026-09-08', 'trial', { leaves: { on: '2026-09-17', reason: 'Cost' } })] }] },
];

/** Made-up people for emergency contacts and pickup lists: a first name takes the family's last name. */
const RELATIVES: [string, string][] = [
  ['June', 'Grandmother'],
  ['Ray', 'Uncle'],
  ['Bea', 'Aunt'],
  ['Joe', 'Grandfather'],
  ['Kim Alder', 'Neighbor'],
  ['Lou', 'Aunt'],
  ['Tom', 'Grandfather'],
];
const relative = (i: number, last: string) => {
  const [name, relationship] = RELATIVES[i % RELATIVES.length];
  return { name: name.includes(' ') ? name : `${name} ${last}`, relationship };
};

/** A 555 number (the range set aside for made-up numbers). */
const phone = (n: number) => `706555${String(100 + (n % 900)).padStart(4, '0')}`;
const slug = (x: string) => x.toLowerCase().replace(/[^a-z]+/g, '');

// ───────────── The clock ─────────────

/**
 * For the build: sets "now" for this whole process, starting at `start` and
 * moved forward only. `new Date()`, `Date.now()` and `Date()` read the story's
 * time; everything else is the real Date. `restore()` goes back to the real
 * clock (forward, since the story ends before the real now).
 */
export function fakeClock(start: Date) {
  const Real = Date;
  let offset = start.getTime() - Real.now();
  const now = () => Real.now() + offset;
  globalThis.Date = new Proxy(Real, {
    construct: (target, args, newTarget) => Reflect.construct(target, args.length ? args : [now()], newTarget),
    apply: () => new Real(now()).toString(),
    get: (target, prop, receiver) => (prop === 'now' ? now : Reflect.get(target, prop, receiver)),
  });
  return {
    set(at: Date) {
      if (at.getTime() > now()) offset = at.getTime() - Real.now();
    },
    restore() {
      offset = 0;
      globalThis.Date = Real;
    },
  };
}

// ───────────── The story ─────────────

export interface DemoSummary {
  families: number;
  children: number;
  enrollments: number;
  taps: number;
  billingRuns: number;
}

/** When the story starts: the owner sets up staff a fortnight before the term. */
export const DEMO_START = athensInstant('2026-08-03', '08:00');

interface Event {
  at: Date;
  what: string;
  run: () => Promise<unknown>;
}

/**
 * Plays the story up to `until` (events after it don't happen). Throws when
 * the database already has families: the demo is made once, on an empty one.
 */
export async function seedDemo({ until, setNow }: { until: Date; setNow: (at: Date) => void }): Promise<DemoSummary> {
  const db = await getDb();
  if ((await db.select({ id: schema.household.id }).from(schema.household).limit(1)).length) throw new Error('The database already has families; the demo is only made on an empty one.');
  const catalog = await getCatalog();
  const today = todayInAthens(until);
  const summary: DemoSummary = { families: 0, children: 0, enrollments: 0, taps: 0, billingRuns: 0 };
  const events: Event[] = [];
  const add = (date: string, time: string, what: string, run: () => Promise<unknown>) => events.push({ at: athensInstant(date, time), what, run });
  const found = (id: string) => {
    const f = catalog.findSession(id);
    if (!f) throw new Error(`Demo class ${id} isn't in the content`);
    return f;
  };

  // People the events below fill in as they happen.
  const ownerUser = { id: crypto.randomUUID(), email: OWNER.email, name: OWNER.name, emailVerified: true };
  const owner: StaffUser = ownerUser;
  const teachers: (Viewer & { email: string })[] = [];
  const homes = new Map<string, { householdId: string; userId: string; kids: Map<string, string> }>();
  /** Order and enrollment ids, by family last name, child and class. */
  const orders = new Map<string, string>();
  const key = (last: string, first: string, session: string) => `${last} ${first} ${session}`;

  // ── Aug 3: the owner sets up the staff and who teaches what ──
  add('2026-08-03', '08:00', 'staff', async () => {
    await db.insert(schema.user).values(ownerUser);
    await addStaff(ownerUser.id, { email: OWNER.email, name: OWNER.name, role: 'owner' });
    for (const t of TEACHERS) {
      const id = crypto.randomUUID();
      await db.insert(schema.user).values({ id, email: t.email, name: t.name, emailVerified: true });
      const row = await addStaff(ownerUser.id, { email: t.email, name: t.name, role: 'teacher' });
      teachers.push({ userId: id, staffId: row.id, role: 'teacher', email: t.email });
    }
    for (const [n] of teachers.entries()) {
      const mine = new Map(Object.entries(TEACHING).flatMap(([session, list]) => list.filter(([, i]) => i === n).map(([role]) => [session, role] as const)));
      await setClasses(ownerUser.id, teachers[n].staffId, mine);
    }
    // Last season's totals, as Hannah would type them in from Studio Director (made up).
    await setSetting(ownerUser.id, 'reports.baseline', {
      season: 'Spring 2026',
      children: 34,
      returning: 21,
      classes: [
        { title: 'Intro to Theater', enrolled: 16 },
        { title: 'Yes, And! Improv', enrolled: 6 },
        { title: 'Performance Troupe', enrolled: 5 },
        { title: 'Film Creation', enrolled: 4 },
      ],
      monthly: [
        { month: '2025-08', collectedCents: 241_000 },
        { month: '2025-09', collectedCents: 262_500 },
        { month: '2025-10', collectedCents: 255_000 },
        { month: '2025-11', collectedCents: 249_000 },
        { month: '2025-12', collectedCents: 203_500 },
        { month: '2026-01', collectedCents: 268_000 },
        { month: '2026-02', collectedCents: 231_500 },
        { month: '2026-03', collectedCents: 239_000 },
        { month: '2026-04', collectedCents: 226_500 },
        { month: '2026-05', collectedCents: 198_000 },
      ],
    });
  });

  // ── Families sign up, each child for their classes ──
  FAMILIES.forEach((f, fi) => {
    const first = f.kids.flatMap((k) => k.classes.map((c) => c.on)).sort()[0];
    add(first, `${String(8 + (fi % 10)).padStart(2, '0')}:15`, `family ${f.last}`, async () => {
      const userId = crypto.randomUUID();
      const email = f.email ?? `${slug(f.parent)}.${slug(f.last)}@example.com`;
      await db.insert(schema.user).values({ id: userId, email, name: `${f.parent} ${f.last}`, emailVerified: true, phone: phone(fi * 3) });
      const h = await ensureHousehold({ id: userId, email, name: `${f.parent} ${f.last}`, emailVerified: true });
      if (f.second) {
        const id = crypto.randomUUID();
        await db.insert(schema.user).values({ id, email: `${slug(f.second)}.${slug(f.last)}@example.com`, name: `${f.second} ${f.last}`, emailVerified: true, phone: phone(fi * 3 + 1) });
        await db.insert(schema.householdMember).values({ householdId: h.id, userId: id });
      }
      if (!f.noDetails) {
        const details = familyDetailsInput.parse({
          emergencyContacts: [{ ...relative(fi, f.last), phone: phone(fi * 3 + 2) }],
          // Most families list someone who may pick up besides the parents.
          pickupPeople: fi % 4 === 3 ? [] : [relative(fi + 1, f.last)],
          zip: f.zip,
          heardAbout: f.heard,
        });
        await updateFamilyDetails(h.id, details, userId);
      } else {
        await db.update(schema.household).set({ zip: f.zip, heardAbout: f.heard }).where(eq(schema.household.id, h.id));
      }
      const kids = new Map<string, string>();
      for (const [ki, k] of f.kids.entries()) {
        const birth = addDays(todayInAthens(), -(k.age * 365 + 40 + ki * 17 + fi * 5));
        const kid = await createStudent(h.id, { firstName: k.first, lastName: f.last, birthdate: birth }, userId);
        if (!f.noDetails) await updateStudentDetails(h.id, kid.id, { allergies: k.allergies ?? '', medicalNotes: k.medical ?? '', pickupNotes: '', photoConsent: k.photo ?? fi % 5 !== 2 }, userId);
        kids.set(k.first, kid.id);
        summary.children++;
      }
      homes.set(f.last, { householdId: h.id, userId, kids });
      summary.families++;
    });
    for (const k of f.kids) {
      for (const [ci, c] of k.classes.entries()) {
        add(c.on, `${String(9 + (fi % 10)).padStart(2, '0')}:${String(20 + ci * 7).padStart(2, '0')}`, `sign up ${k.first} ${c.session}`, async () => {
          const home = homes.get(f.last)!;
          const o = await signUp(home, k.first, c.session, c.plan);
          orders.set(key(f.last, k.first, c.session), o);
          summary.enrollments++;
        });
        if (c.continues) {
          add(c.continues, '19:30', `${k.first} continues ${c.session}`, async () => {
            const o = await signUp(homes.get(f.last)!, k.first, c.session, 'monthly');
            orders.set(key(f.last, k.first, c.session), o);
          });
        }
        if (c.leaves) {
          const leaves = c.leaves;
          add(leaves.on, '12:00', `${k.first} leaves ${c.session}`, async () => {
            const e = await enrollmentOf(homes.get(f.last)!.kids.get(k.first)!, c.session);
            if (e) await removeChild(e, c.session, 'stop', ownerUser.id, leaves.reason);
          });
        }
      }
    }
  });

  /** Sign-up and checkout as the family would, paid with the test stand-in. Returns the order's id. */
  async function signUp(home: { householdId: string; userId: string; kids: Map<string, string> }, first: string, sessionId: string, plan: Plan) {
    const draft = await createDraftOrder(home.householdId, home.userId, sessionId, [home.kids.get(first)!]);
    const o = await confirmOrder(home.householdId, draft.id, plan, home.userId);
    if (o.status !== 'paid') {
      // The card Stripe would save for autopay, as the test payment page does.
      if (o.plan === 'monthly') await db.update(schema.household).set({ stripeCustomerId: 'test_customer', stripePaymentMethodId: 'test_card', cardBrand: 'visa', cardLast4: '4242', cardExpMonth: 12, cardExpYear: 2029 }).where(eq(schema.household.id, home.householdId));
      await fulfillOrder(o.id, home.userId);
    }
    return o.id;
  }

  async function enrollmentOf(studentId: string, sessionId: string) {
    const [e] = await db.select({ id: schema.enrollment.id }).from(schema.enrollment).where(and(eq(schema.enrollment.studentId, studentId), eq(schema.enrollment.sessionId, sessionId)));
    return e?.id ?? null;
  }
  const kidId = (last: string, first: string) => homes.get(last)!.kids.get(first)!;

  /** A family's payment for a month ("2026-10") of one class. */
  async function monthPayment(last: string, first: string, sessionId: string, month: string) {
    const orderId = orders.get(key(last, first, sessionId));
    if (!orderId) return null;
    const rows = await db.select().from(schema.installment).where(eq(schema.installment.orderId, orderId));
    return rows.find((i) => i.dueDate.slice(0, 7) === month) ?? null;
  }

  // ── Money: a scholarship, a credit, a cash payment, two cards that stop working, a refund ──
  add('2026-08-20', '10:00', 'scholarship', async () => {
    const orderId = orders.get(key('Walker', 'Zoe', INTRO));
    if (orderId) await addAdjustment(owner, { orderId, kind: 'amount', value: 4000, repeat: 'monthly', reason: 'Scholarship', showToFamily: false });
  });
  add('2026-09-23', '10:00', 'credit', () => addCredit(owner, { householdId: homes.get('Kim')!.householdId, amountCents: 2375, reason: 'Missed class Sep 22 (sick)', showToFamily: true }));
  add('2026-09-25', '09:00', 'cards stop working', async () => {
    for (const [last, exp] of [['Johnson', 2026], ['Walker', 2028]] as const) {
      await db.update(schema.household).set({ stripePaymentMethodId: 'test_card_declined', cardExpMonth: 9, cardExpYear: exp }).where(eq(schema.household.id, homes.get(last)!.householdId));
    }
  });
  add('2026-09-28', '15:00', 'paid by check', async () => {
    // Two families pay October by check: the Sullivans' is refunded by check later, which works with Stripe keys set or not.
    for (const [last, first, session] of [['Hughes', 'Nora', INTRO], ['Sullivan', 'Iris', FILM]] as const) {
      const i = await monthPayment(last, first, session, '2026-10');
      if (i) await markPaidOutsideStripe(i.id, ownerUser.id);
    }
  });
  add('2026-10-05', '11:00', 'Iris leaves Film, refund', async () => {
    const e = await enrollmentOf(kidId('Sullivan', 'Iris'), FILM);
    if (e) await removeChild(e, FILM, 'stop', ownerUser.id, 'Schedule');
    const oct = await monthPayment('Sullivan', 'Iris', FILM, '2026-10');
    if (!oct) return;
    // Paid by check, so refunded by check: recorded, no Stripe call.
    await createRefund(owner, { orderId: oct.orderId, installmentId: oct.id, amountCents: Math.round(oct.amountCents / 2), reason: 'Left Film after the first week of October', emailFamily: true });
  });
  add('2026-10-12', '09:30', 'late fee waived', async () => {
    const i = await monthPayment('Walker', 'Zoe', INTRO, '2026-10');
    if (i && i.lateFeeCents > 0) await waiveLateFee(i.id, ownerUser.id);
  });

  // ── Days off: a fall break already paid for (credits), and Thanksgiving week (payments lowered) ──
  let fallBreak: string[] = [];
  add('2026-10-06', '14:00', 'fall break', async () => {
    fallBreak = (await addDayOff(owner, catalog, { from: '2026-10-14', to: '2026-10-14', sessionIds: [YESAND, TROUPE], reason: 'Fall break', payments: 'lower' })).closureIds;
  });
  add('2026-10-07', '09:00', 'give fall break credits', () => giveDayOffCredits(owner, catalog, fallBreak));
  add('2026-10-20', '13:00', 'Thanksgiving', () => addDayOff(owner, catalog, { from: '2026-11-23', to: '2026-11-27', sessionIds: null, reason: 'Thanksgiving', payments: 'lower' }));

  // ── A drop-in, tags, skills, the fall show, website enquiries ──
  add('2026-10-12', '20:00', 'drop-in', async () => {
    const home = homes.get('Cruz')!;
    const b = await startDropIn({ householdId: home.householdId, userId: home.userId, sessionId: YESAND, date: '2026-10-21', studentId: home.kids.get('Leah')! }, { catalog });
    await readyDropIn(home.householdId, b.order.id, { catalog });
    await fulfillOrder(b.order.id, home.userId);
  });
  add('2026-09-05', '10:00', 'tags', async () => {
    const ride = await findOrCreateTag(ownerUser.id, 'child', 'Needs a ride');
    await tagStudents(ownerUser.id, ride.id, [kidId('Foster', 'Owen'), kidId('Ward', 'Theo')]);
    const scholarship = await findOrCreateTag(ownerUser.id, 'family', 'Scholarship');
    await tagHousehold(ownerUser.id, scholarship.id, homes.get('Walker')!.householdId);
    const volunteer = await findOrCreateTag(ownerUser.id, 'family', 'Show volunteer');
    for (const last of ['Rivera', 'Bennett', 'Howard']) await tagHousehold(ownerUser.id, volunteer.id, homes.get(last)!.householdId);
  });
  const skillIds: string[] = [];
  add('2026-09-01', '10:00', 'skills', async () => {
    for (const name of ['Projects their voice', 'Stays in character', 'Listens to scene partners', 'Remembers blocking']) skillIds.push((await addSkill(ownerUser.id, 'intro-to-theater', name)).id);
  });
  add('2026-10-22', '10:00', 'fall show cast and rehearsal', async () => {
    const roles: [string, string, string][] = [
      ['Rivera', 'Leo', 'Chorus'],
      ['Ross', 'Ivy', 'Chorus'],
      ['Gray', 'Noah', 'Chorus'],
      ['Garcia', 'Mateo', 'Narrator'],
      ['Murphy', 'June', 'Director’s assistant'],
      ['Howard', 'Quinn', 'Lead'],
      ['Thompson', 'Ella', 'Camera'],
    ];
    for (const [last, first, role] of roles) await addToCast(SHOW, [kidId(last, first)], ownerUser.id, { role });
    await addRehearsal(SHOW, { date: '2026-11-14', start: '10:00', end: '12:00', locationId: 'hq', note: 'Whole cast. Bring water and wear comfortable shoes.', sessionIds: [] }, ownerUser.id, catalog);
  });
  const leads: [string, string, Record<string, string>][] = [
    ['2026-09-02', '19:45', { kind: 'contact', email: 'robin.hale@example.com', name: 'Robin Hale', topic: 'class', message: 'My daughter is 6 and very shy. Which class would you recommend?' }],
    ['2026-09-18', '12:10', { kind: 'newsletter', email: 'sky.moreno@example.com' }],
    ['2026-10-03', '08:30', { kind: 'notify', email: 'ash.kent@example.com', program: 'summer-camp' }],
    ['2026-10-16', '21:05', { kind: 'contact', email: 'jules.park@example.com', name: 'Jules Park', topic: 'party', message: 'Could we book a theater birthday party for eight 9-year-olds in December?' }],
  ];
  for (const [date, time, input] of leads) add(date, time, `lead ${input.kind}`, () => saveLead(leadInput.parse(input)));

  // ── Billing: the daily run, from the first charge day on ──
  const charge: Charger = async (req) => {
    if (req.paymentMethodId === 'test_card_declined') return { status: 'failed', code: req.attempt > 1 ? 'insufficient_funds' : 'card_declined', retry: true };
    const id = `test_pi_${req.installmentId.slice(0, 8)}_${req.attempt}`;
    await req.remember(id);
    return { status: 'succeeded', paymentIntentId: id };
  };
  for (let d = '2026-09-01'; d <= today; d = addDays(d, 1)) {
    const day = d;
    add(day, '06:00', `billing ${day}`, async () => {
      await runBilling({ charge, today: day });
      summary.billingRuns++;
    });
  }

  // ── Attendance: each class date, taken by its teacher after class ──
  const sessions = [INTRO, YESAND, PRODUCE, TROUPE, FILM, STORIES, ACTING, HOMESCHOOL];
  const lastBefore = async (sessionId: string) =>
    (await classDates(found(sessionId).session)).filter((d) => !d.dayOff && d.date < today).map((d) => d.date).pop();
  for (const sessionId of sessions) {
    const { session } = found(sessionId);
    const lead = TEACHING[sessionId].find(([role]) => role === 'lead')![1];
    for (const [di, date] of meetings(session).entries()) {
      if (date >= today) continue;
      add(date, addMinutes(session.end ?? '18:00', 25), `attendance ${sessionId} ${date}`, async () => {
        const off = (await classDates(session)).find((d) => d.date === date)?.dayOff;
        if (off) return;
        const latest = await lastBefore(sessionId);
        // This week's Film class is left for the teacher: Hannah sees "Attendance not taken".
        if (sessionId === FILM && date === latest && daysBetween(date, today) <= 6) return;
        await takeAttendance(teachers[lead], session, date, di, date === latest);
      });
    }
  }

  async function takeAttendance(teacher: Viewer, session: Session, date: string, di: number, latest: boolean) {
    const expected = await expectedOn(session.id, date);
    const now = new Date();
    const intro = session.id === INTRO;
    // Kai has missed the last two Intro classes: "Missed two in a row".
    const kai = intro ? kidId('Nguyen', 'Kai') : null;
    const missing = intro ? (await introDates()).slice(-2) : [];
    const taps = [...expected.keys()].map((studentId, ci) => {
      const absent = (studentId === kai && missing.includes(date)) || (ci * 7 + di * 3) % 23 === 0;
      const late = !absent && (ci * 5 + di) % 31 === 0;
      return {
        clientId: crypto.randomUUID(),
        sessionId: session.id,
        date,
        studentId,
        status: absent ? ('absent' as const) : late ? ('late' as const) : ('present' as const),
        note: late ? 'Arrived 10 minutes late' : '',
        reason: absent ? (studentId === kai ? 'Sick' : ['Sick', 'Travel', 'Family'][(ci + di) % 3]) : '',
        markedAt: now.toISOString(),
      };
    });
    const saved = await saveTaps(teacher, taps, catalog, now);
    summary.taps += saved.filter((r) => r.result === 'saved').length;
    const note = intro && latest ? 'Great energy today! We’re out of glue sticks for the prop table. Could we get more before next week?' : '';
    await saveReports(teacher, [{ clientId: crypto.randomUUID(), sessionId: session.id, date, note, at: now.toISOString() }], catalog, now);
    if (!intro || skillIds.length === 0) return;
    // Skills ticked on the last two class dates, and a progress note for Hannah to send.
    const recent = (await introDates()).slice(-2);
    if (!recent.includes(date)) return;
    for (const [ci, studentId] of [...expected.keys()].entries()) {
      if (ci % 2 === 1) continue;
      await setSkill(teacher, { sessionId: session.id, date, studentId, skillId: skillIds[ci % skillIds.length], status: ci % 4 === 0 ? 'got_it' : 'working' }, catalog, now);
    }
    if (latest) await saveTeacherDraft(teacher, { sessionId: session.id, date, studentId: kidId('Rivera', 'Mia'), body: 'Mia led the warm-up today and helped a new friend find her place on stage.' }, catalog);
  }
  /** Intro's class dates so far, worked out each time: days off are added as the story goes. */
  async function introDates() {
    return (await classDates(found(INTRO).session)).filter((d) => !d.dayOff && d.date < today).map((d) => d.date);
  }

  // ── Play it, in order ──
  events.sort((a, b) => a.at.getTime() - b.at.getTime());
  for (const e of events) {
    if (e.at.getTime() > until.getTime()) continue;
    setNow(e.at);
    try {
      await e.run();
    } catch (err) {
      throw new Error(`Demo data: "${e.what}" failed: ${(err as Error).message}`, { cause: err });
    }
  }
  setNow(until);

  // The emails written along the way (confirmations, receipts, sign-up codes): the mailbox starts empty.
  await db.delete(schema.devEmail);
  return summary;
}

const addMinutes = (hhmm: string, minutes: number) => {
  const [h, m] = hhmm.split(':').map(Number);
  const t = h * 60 + m + minutes;
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);

/** Who's in the demo, for the checks: every address and phone number. */
export async function demoContacts() {
  const db = await getDb();
  const users = await db.select({ email: schema.user.email, phone: schema.user.phone }).from(schema.user);
  const homes = await db.select({ contacts: schema.household.emergencyContacts, pickup: schema.household.pickupPeople }).from(schema.household);
  const leads = await db.select({ email: schema.lead.email }).from(schema.lead);
  return {
    emails: [...users.map((u) => u.email), ...leads.map((l) => l.email)],
    phones: [...users.flatMap((u) => (u.phone ? [u.phone] : [])), ...homes.flatMap((h) => [...h.contacts.map((c) => c.phone), ...h.pickup.flatMap((p) => (p.phone ? [p.phone] : []))])],
  };
}

