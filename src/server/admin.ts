/**
 * Staff views. Callers must check `locals.isAdmin` first; every roster view is
 * written to the audit log because rosters include medical notes.
 */
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { getDb, schema } from './db';
import { audit, ageOn, readStudentNotes } from './family';

export async function sessionCounts() {
  const db = await getDb();
  const rows = await db
    .select({ sessionId: schema.enrollment.sessionId, status: schema.enrollment.status, n: sql<number>`count(*)::int` })
    .from(schema.enrollment)
    .where(ne(schema.enrollment.status, 'cancelled'))
    .groupBy(schema.enrollment.sessionId, schema.enrollment.status);
  const out = new Map<string, { active: number; trial: number; waitlist: number }>();
  for (const r of rows) {
    const e = out.get(r.sessionId) ?? { active: 0, trial: 0, waitlist: 0 };
    if (r.status === 'active' || r.status === 'trial' || r.status === 'waitlist') e[r.status] = r.n;
    out.set(r.sessionId, e);
  }
  return out;
}

/**
 * Everyone signed up for a session (not cancelled), with their families'
 * contacts and the children's care details decrypted. Logged as `action`:
 * the page's view, or a print or download (src/server/classes.ts).
 */
export async function roster(sessionId: string, viewerId: string, action = 'admin.roster.view') {
  const db = await getDb();
  const rows = await db
    .select({ enrollment: schema.enrollment, student: schema.student, household: schema.household })
    .from(schema.enrollment)
    .innerJoin(schema.student, eq(schema.student.id, schema.enrollment.studentId))
    .innerJoin(schema.household, eq(schema.household.id, schema.enrollment.householdId))
    .where(and(eq(schema.enrollment.sessionId, sessionId), ne(schema.enrollment.status, 'cancelled')))
    .orderBy(schema.enrollment.status, schema.student.lastName);

  const householdIds = [...new Set(rows.map((r) => r.household.id))];
  const guardians = householdIds.length
    ? await db
        .select({ householdId: schema.householdMember.householdId, name: schema.user.name, email: schema.user.email, phone: schema.user.phone })
        .from(schema.householdMember)
        .innerJoin(schema.user, eq(schema.user.id, schema.householdMember.userId))
        .where(inArray(schema.householdMember.householdId, householdIds))
        .orderBy(schema.householdMember.createdAt)
    : [];

  await audit(viewerId, action, 'session', sessionId);
  return rows.map((r) => ({
    enrollmentId: r.enrollment.id,
    status: r.enrollment.status,
    enrolledAt: r.enrollment.createdAt,
    student: {
      id: r.student.id,
      name: `${r.student.firstName} ${r.student.lastName}`,
      firstName: r.student.firstName,
      lastName: r.student.lastName,
      birthdate: r.student.birthdate,
      age: ageOn(r.student.birthdate),
      photoConsent: r.student.photoConsent,
      pickup: r.student.pickupNotes ?? '',
      ...readStudentNotes(r.student),
    },
    householdId: r.household.id,
    family: r.household.name,
    emergencyContacts: r.household.emergencyContacts ?? [],
    pickupPeople: r.household.pickupPeople ?? [],
    guardians: guardians.filter((g) => g.householdId === r.household.id),
  }));
}
