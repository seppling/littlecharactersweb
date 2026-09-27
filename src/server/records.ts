/**
 * Small shared lookups with no catalog imports, so command-line scripts
 * (billing, imports) can use them outside Astro.
 */
import { eq } from 'drizzle-orm';
import { getDb, schema } from './db';

export async function audit(userId: string | null, action: string, entity?: string, entityId?: string) {
  const db = await getDb();
  await db.insert(schema.auditLog).values({ userId, action, entity, entityId });
}

export async function householdGuardians(householdId: string) {
  const db = await getDb();
  return db
    .select({ email: schema.user.email, name: schema.user.name })
    .from(schema.householdMember)
    .innerJoin(schema.user, eq(schema.user.id, schema.householdMember.userId))
    .where(eq(schema.householdMember.householdId, householdId));
}
