/**
 * Starred reports (`report_favorite`), per staff member: they list first in
 * the library and as a row of links under the dashboard's tiles.
 */
import { and, asc, eq } from 'drizzle-orm';
import { getDb, schema } from '../db';
import { findReport } from './library';

const { reportFavorite } = schema;

/** A staff member's starred report keys, oldest star first (unknown keys left out). */
export async function favorites(staffId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select({ key: reportFavorite.reportKey }).from(reportFavorite).where(eq(reportFavorite.staffId, staffId)).orderBy(asc(reportFavorite.createdAt));
  return rows.map((r) => r.key).filter((k) => !!findReport(k));
}

/** Star or unstar a report. False for a key that isn't a report. */
export async function setFavorite(staffId: string, key: string, on: boolean) {
  if (!findReport(key)) return false;
  const db = await getDb();
  if (on) await db.insert(reportFavorite).values({ staffId, reportKey: key }).onConflictDoNothing();
  else await db.delete(reportFavorite).where(and(eq(reportFavorite.staffId, staffId), eq(reportFavorite.reportKey, key)));
  return true;
}
