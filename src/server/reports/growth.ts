/**
 * Families and growth reports (docs/back-office.md → Reports): how new
 * families heard about us, their ZIP codes, and new families by month.
 *
 * A new family is one whose first sign-up (not the waitlist) was in that
 * season, and that didn't come over from Studio Director: families imported
 * from there were already Little Characters families.
 */
import { getDb, schema } from '../db';
import { heardAboutLabel, HEARD_ABOUT } from '@/lib/family-details';
import { todayInAthens } from '@/lib/pricing';
import type { EnrollRow } from './enrollment';
import { lastTwelve, monthShort, percent, plural, sessionPasses, sum, termOf, type Content, type ReportFilters, type ReportResult } from './common';

export interface FamilyRow {
  id: string;
  name: string;
  zip: string | null;
  heardAbout: string | null;
  source: string;
}

export async function loadFamilies(): Promise<FamilyRow[]> {
  const db = await getDb();
  const h = schema.household;
  return db.select({ id: h.id, name: h.name, zip: h.zip, heardAbout: h.heardAbout, source: h.source }).from(h);
}

/** Each family's first sign-up (any class, not the waitlist): its class and when. */
export function firstSignUps(enrollments: Pick<EnrollRow, 'householdId' | 'sessionId' | 'status' | 'createdAt'>[]) {
  const first = new Map<string, { sessionId: string; at: Date }>();
  for (const e of enrollments) {
    if (e.status === 'waitlist') continue;
    const f = first.get(e.householdId);
    if (!f || e.createdAt < f.at) first.set(e.householdId, { sessionId: e.sessionId, at: e.createdAt });
  }
  return first;
}

const isImported = (f: FamilyRow) => f.source === 'studio-director';

/** The families a season's growth reports count: new that season (default), or every family with a child enrolled then. */
export function seasonFamilies(families: FamilyRow[], enrollments: EnrollRow[], content: Pick<Content, 'findSession'>, season: string | null, f: ReportFilters) {
  if (!season) return [];
  if (f.who === 'all') {
    const ids = new Set(enrollments.filter((e) => (e.status === 'active' || e.status === 'trial') && termOf(content, e.sessionId) === season && sessionPasses(f, content.findSession(e.sessionId))).map((e) => e.householdId));
    return families.filter((x) => ids.has(x.id));
  }
  const first = firstSignUps(enrollments);
  return families.filter((x) => {
    const s = first.get(x.id);
    return !isImported(x) && !!s && termOf(content, s.sessionId) === season && sessionPasses(f, content.findSession(s.sessionId));
  });
}

const whoLabel = (f: ReportFilters, season: string | null) => (f.who === 'all' ? `Families in ${season}` : `New families in ${season}`);

/** New families by their answer to "How did you hear about us?". */
export function heardAboutFrom(families: FamilyRow[], enrollments: EnrollRow[], content: Pick<Content, 'findSession'>, season: string | null, f: ReportFilters): ReportResult {
  const list = seasonFamilies(families, enrollments, content, season, f);
  const by = new Map<string, number>();
  for (const x of list) {
    const label = heardAboutLabel(x.heardAbout) || 'Not answered';
    by.set(label, (by.get(label) ?? 0) + 1);
  }
  // The listed answers in the form's order, then anything typed in, then "Not answered".
  const order = (label: string) => {
    const i = HEARD_ABOUT.findIndex((o) => o.label === label);
    return i >= 0 ? i : label === 'Not answered' ? 99 : 50;
  };
  const rows = [...by.entries()].sort((a, b) => b[1] - a[1] || order(a[0]) - order(b[0]) || a[0].localeCompare(b[0]));
  return {
    columns: [{ label: 'How they heard' }, { label: 'Families', kind: 'number' }, { label: 'Share', kind: 'percent' }],
    rows: rows.map(([label, n]) => ({ cells: [label, n, percent(n, list.length)] })),
    total: { value: season ? list.length : null, display: season ? list.length.toLocaleString('en-US') : 'No season yet', label: whoLabel(f, season) },
    empty: f.who === 'all' ? `No families with a class in ${season ?? 'this season'} yet.` : `No new families in ${season ?? 'this season'} yet.`,
  };
}

/** Families by ZIP code, most first. */
export function zipFrom(families: FamilyRow[], enrollments: EnrollRow[], content: Pick<Content, 'findSession'>, season: string | null, f: ReportFilters): ReportResult {
  const list = seasonFamilies(families, enrollments, content, season, f);
  const by = new Map<string, number>();
  for (const x of list) {
    const zip = x.zip?.trim() || 'Not given';
    by.set(zip, (by.get(zip) ?? 0) + 1);
  }
  const rows = [...by.entries()].sort((a, b) => Number(a[0] === 'Not given') - Number(b[0] === 'Not given') || b[1] - a[1] || a[0].localeCompare(b[0]));
  return {
    columns: [{ label: 'ZIP code' }, { label: 'Families', kind: 'number' }, { label: 'Share', kind: 'percent' }],
    rows: rows.map(([zip, n]) => ({ cells: [zip, n, percent(n, list.length)] })),
    total: { value: season ? list.length : null, display: season ? list.length.toLocaleString('en-US') : 'No season yet', label: whoLabel(f, season) },
    empty: f.who === 'all' ? `No families with a class in ${season ?? 'this season'} yet.` : `No new families in ${season ?? 'this season'} yet.`,
  };
}

/** New families by the month of their first sign-up, the last 12 months. */
export function newFamiliesFrom(families: FamilyRow[], enrollments: EnrollRow[], today: string): ReportResult {
  const first = firstSignUps(enrollments);
  const months = lastTwelve(today.slice(0, 7));
  const by = new Map(months.map((m) => [m, [] as FamilyRow[]]));
  for (const x of families) {
    const s = first.get(x.id);
    if (isImported(x) || !s) continue;
    by.get(todayInAthens(s.at).slice(0, 7))?.push(x);
  }
  const n = sum([...by.values()].map((l) => l.length));
  return {
    columns: [{ label: 'Month' }, { label: 'New families', kind: 'number' }],
    rows: months.map((m) => ({ cells: [monthShort(m), by.get(m)!.length] })),
    total: { value: n, display: n ? plural(n, 'family', 'families') : 'None yet', label: `New families ${monthShort(months[0])} to ${monthShort(months[11])}` },
    empty: 'No new families yet.',
  };
}

