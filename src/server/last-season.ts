/**
 * Settings → Last season: the form for last season's totals from Studio
 * Director, saved as `reports.baseline` (src/server/settings-store.ts) for the
 * dashboard's comparisons (the reports unit reads it; nothing else does).
 * Totals only: no family names.
 */
import { baselineSchema, type Baseline } from './settings-store';

export interface BaselineForm {
  season: string;
  children: string;
  returning: string;
  classTitle: string[];
  classEnrolled: string[];
  month: string[];
  collected: string[];
}

/** Pure: "$1,234.50" or "1234.5" → 123450 cents; null when it isn't an amount. */
export function dollarsToCents(s: string): number | null {
  const t = s.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return null;
  const [whole, frac = ''] = t.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

/** Pure: a count, or null when it isn't a whole number. Blank is undefined. */
function count(s: string): number | null | undefined {
  const t = s.replace(/[,\s]/g, '');
  if (!t) return undefined;
  return /^\d+$/.test(t) ? Number(t) : null;
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Pure: the form's fields as a Baseline, or an error in Hannah's words.
 * Rows left empty are ignored; a half-filled row is an error that names it.
 */
export function baselineFromForm(f: BaselineForm): { value: Baseline; error?: undefined } | { value?: undefined; error: string } {
  const season = f.season.replace(/\s+/g, ' ').trim();
  if (!season) return { error: 'Name the season, like “Spring 2026”.' };
  if (season.length > 40) return { error: 'Keep the season’s name under 40 characters.' };
  const children = count(f.children);
  const returning = count(f.returning);
  if (children === null) return { error: 'Children that season: a whole number.' };
  if (returning === null) return { error: 'How many came back: a whole number.' };
  if (children !== undefined && returning !== undefined && returning > children) return { error: 'More came back than there were children. Check the two numbers.' };

  const classes: Baseline['classes'] = [];
  for (let i = 0; i < Math.max(f.classTitle.length, f.classEnrolled.length); i++) {
    const title = (f.classTitle[i] ?? '').replace(/\s+/g, ' ').trim();
    const raw = (f.classEnrolled[i] ?? '').trim();
    if (!title && !raw) continue;
    if (!title) return { error: `Class row ${i + 1}: add the class’s name.` };
    const n = count(raw);
    if (n === undefined || n === null) return { error: `${title}: how many were enrolled, as a whole number.` };
    if (title.length > 120) return { error: `${title.slice(0, 30)}…: keep the name under 120 characters.` };
    if (n > 1000) return { error: `${title}: that’s more than 1,000 children.` };
    classes.push({ title, enrolled: n });
  }

  const monthly: Baseline['monthly'] = [];
  for (let i = 0; i < Math.max(f.month.length, f.collected.length); i++) {
    const month = (f.month[i] ?? '').trim();
    const raw = (f.collected[i] ?? '').trim();
    if (!month && !raw) continue;
    if (!MONTH.test(month)) return { error: `Money row ${i + 1}: pick the month.` };
    const cents = dollarsToCents(raw);
    if (cents === null) return { error: `${month}: the amount collected, in dollars, like 9500 or 9,500.00.` };
    if (monthly.some((m) => m.month === month)) return { error: `${month} is there twice.` };
    monthly.push({ month, collectedCents: cents });
  }
  monthly.sort((a, b) => a.month.localeCompare(b.month));

  const parsed = baselineSchema.safeParse({ season, ...(children !== undefined ? { children } : {}), ...(returning !== undefined ? { returning } : {}), classes, monthly });
  if (!parsed.success) return { error: 'Some numbers are too big. Check them and save again.' };
  return { value: parsed.data };
}

/** The saved value as form fields, for showing it again. */
export function formFromBaseline(b: Baseline | null): BaselineForm {
  return {
    season: b?.season ?? '',
    children: b?.children !== undefined ? String(b.children) : '',
    returning: b?.returning !== undefined ? String(b.returning) : '',
    classTitle: b?.classes.map((c) => c.title) ?? [],
    classEnrolled: b?.classes.map((c) => String(c.enrolled)) ?? [],
    month: b?.monthly.map((m) => m.month) ?? [],
    collected: b?.monthly.map((m) => (m.collectedCents / 100).toFixed(2)) ?? [],
  };
}
