/**
 * "Give these credits" on the Days off page: the families whose month was
 * already paid when a day off was added (days-off.ts writes one
 * `admin.day_off.credit_due` audit entry per family's order and date, the
 * closure's id in `detail`) get a credit for one class's worth
 * (`oneClassCents`), shown to the family as "Day off Dec 8 (Thanksgiving)".
 *
 * One credit per family and date. Its id is fixed (`dayoff-<closure>-<family>`),
 * so giving them twice adds nothing: that is how they're marked done.
 */
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { SiteContent } from '@/content/site-content';
import { addCredit, CreditError } from './credits';
import { getDb, schema } from './db';
import { adjustmentReason, oneClassCents } from './days-off';
import type { StaffUser } from './adjustments';

const { auditLog, closure, credit, household, installment, order } = schema;
type Catalog = Pick<SiteContent, 'findSession'>;

export const CREDIT_DUE = 'admin.day_off.credit_due';

export interface DayOffCredit {
  /** The credit's id once given. */
  id: string;
  householdId: string;
  family: string;
  date: string;
  /** "Day off Dec 8 (Thanksgiving)" */
  reason: string;
  /** One class's worth per class the family had that day; null when it can't be worked out. */
  cents: number | null;
  given: boolean;
}

export const dayOffCreditId = (closureId: string, householdId: string) => `dayoff-${closureId}-${householdId}`;

/** For a group of days off (their closure ids): each family and date to credit, and whether it was given. */
export async function dayOffCredits(catalog: Catalog, closureIds: string[]): Promise<DayOffCredit[]> {
  if (!closureIds.length) return [];
  const db = await getDb();
  const due = await db
    .select({ closureId: auditLog.detail, o: order, family: household.name, date: closure.date, why: closure.reason })
    .from(auditLog)
    .innerJoin(closure, eq(closure.id, auditLog.detail))
    .innerJoin(order, eq(order.id, auditLog.entityId))
    .innerJoin(household, eq(household.id, order.householdId))
    .where(and(eq(auditLog.action, CREDIT_DUE), inArray(auditLog.detail, closureIds)));
  if (!due.length) return [];
  const orderIds = [...new Set(due.map((d) => d.o.id))];
  const insts = await db.select().from(installment).where(inArray(installment.orderId, orderIds)).orderBy(asc(installment.dueDate));

  // One per family and date; the same order logged twice counts once.
  const groups = new Map<string, { closureIds: Set<string>; householdId: string; family: string; date: string; why: string; orders: Map<string, number | null> }>();
  for (const d of due) {
    const key = `${d.o.householdId} ${d.date}`;
    const g = groups.get(key) ?? { closureIds: new Set(), householdId: d.o.householdId, family: d.family, date: d.date, why: d.why, orders: new Map() };
    g.closureIds.add(d.closureId!);
    if (!g.orders.has(d.o.id)) g.orders.set(d.o.id, classWorth(d.o, insts, d.date, catalog));
    groups.set(key, g);
  }
  const list = [...groups.values()].map((g) => {
    const first = [...g.closureIds].sort()[0];
    const amounts = [...g.orders.values()];
    return {
      id: dayOffCreditId(first, g.householdId),
      householdId: g.householdId,
      family: g.family,
      date: g.date,
      reason: adjustmentReason(g.date, g.why),
      cents: amounts.some((a) => a === null) ? null : amounts.reduce<number>((s, a) => s + (a ?? 0), 0),
      given: false,
    };
  });
  const given = new Set((await db.select({ id: credit.id }).from(credit).where(inArray(credit.id, list.map((c) => c.id)))).map((c) => c.id));
  return list.map((c) => ({ ...c, given: given.has(c.id) })).sort((a, b) => a.date.localeCompare(b.date) || a.family.localeCompare(b.family));
}

/**
 * One class's worth of that month's payment, as a day off lowers one: the
 * month's installment, or for a first month paid at sign-up, the next month's
 * (a full month's payment, the same as the others).
 */
function classWorth(o: typeof order.$inferSelect, insts: (typeof installment.$inferSelect)[], date: string, catalog: Catalog) {
  const session = catalog.findSession(o.sessionId)?.session;
  if (!session) return null;
  const mine = insts.filter((i) => i.orderId === o.id);
  const inst = mine.find((i) => i.dueDate.slice(0, 7) === date.slice(0, 7)) ?? mine[0];
  const base = inst?.baseAmountCents ?? o.schedule[0]?.amountCents;
  return base ? oneClassCents(base, session, date.slice(0, 7)) || null : null;
}

/** Give every credit not given yet in a group. Returns how many were given now. */
export async function giveDayOffCredits(staff: StaffUser, catalog: Catalog, closureIds: string[], now = new Date()) {
  const list = await dayOffCredits(catalog, closureIds);
  let given = 0;
  for (const c of list) {
    if (c.given || !c.cents) continue;
    try {
      const r = await addCredit(staff, { householdId: c.householdId, amountCents: c.cents, reason: c.reason, showToFamily: true }, { now, id: c.id, detail: `day off ${c.date}` });
      if (r) given++;
    } catch (e) {
      if (!(e instanceof CreditError)) throw e;
      throw new CreditError(`${c.family}: ${e.message}`);
    }
  }
  return given;
}
