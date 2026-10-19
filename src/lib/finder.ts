/**
 * The class finder's order once a family picks an age (/programs?age=14-17).
 *
 * 1. Programs anyone can join come before ones with a limit: a class only for
 *    one school's students, or a weekly class held during school hours (the
 *    homeschool class).
 * 2. Then programs whose ages cover the whole chosen range, narrowest range
 *    first: Acting Studio (11–17) leads for 14–17, ahead of "Ages 6+", "7+",
 *    "8+", "9+". A range with no top age ("4+") counts as running to 120.
 * 3. Then programs that only overlap part of the range, narrowest first.
 * 4. Ties keep the page's usual order (classes, then camps, then the rest;
 *    youngest first).
 *
 * With no age chosen, the page keeps its usual order.
 */
import type { Location, Program } from '@/content/types';

/** Why a program isn't open to every family, if it isn't. */
export type FinderLimit = 'school' | 'school-hours';

export interface FinderItem {
  ageMin: number;
  /** Highest age; use 120 for "and up". */
  ageMax: number;
  limit?: FinderLimit;
}

const OPEN_TOP = 120;
const WEEKDAYS = new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
/** Sessions that start before this are during the school day. */
const SCHOOL_DAY_ENDS = '15:00';

/**
 * A program is for one school's students when every date is booked through an
 * outside link and held somewhere other than our studio (Athens Academy
 * Enrichment). It's in school hours when it's a weekly class whose every date
 * starts before 3 pm on a weekday (the homeschool class).
 */
export function finderLimit(program: Pick<Program, 'kind' | 'sessions'>, studioId = 'hq'): FinderLimit | undefined {
  const { sessions } = program;
  if (sessions.length === 0) return undefined;
  if (sessions.every((s) => s.externalUrl && s.locationId !== studioId)) return 'school';
  if (program.kind === 'class' && sessions.every((s) => s.days.length > 0 && s.days.every((d) => WEEKDAYS.has(d)) && s.start < SCHOOL_DAY_ENDS)) {
    return 'school-hours';
  }
  return undefined;
}

/** "Athens Academy students only", for a class run for one school. */
export function schoolOnlyLabel(program: Pick<Program, 'sessions'>, locationById: (id: string) => Location | undefined): string | undefined {
  const school = program.sessions[0] && locationById(program.sessions[0].locationId);
  return school ? `${school.shortName} students only` : undefined;
}

/** Sort key parts for one program; lower sorts first. */
export function fitKey(item: FinderItem, band: readonly [number, number]): [number, number, number] {
  const max = Math.min(item.ageMax, OPEN_TOP);
  const covers = item.ageMin <= band[0] && max >= band[1];
  return [item.limit ? 1 : 0, covers ? 0 : 1, max - item.ageMin];
}

/** The items in finder order for an age band. Stable: ties keep their given order. */
export function sortByFit<T extends FinderItem>(items: readonly T[], band: readonly [number, number] | undefined): T[] {
  if (!band) return [...items];
  const keyed = items.map((item, index) => ({ item, index, key: fitKey(item, band) }));
  keyed.sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2] || a.index - b.index);
  return keyed.map((k) => k.item);
}
