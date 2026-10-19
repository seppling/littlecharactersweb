/**
 * The small labels beside a child's name on staff pages: allergy, pickup note,
 * no photos, new, trial, birthday (docs/back-office.md). Always in the same
 * order, so staff learn where to look.
 *
 * The input is yes/no facts only. The notes themselves never reach a badge,
 * so they can't end up in an attribute, a URL or a log.
 */
import { todayInAthens } from './pricing';

export type BadgeTone = 'neutral' | 'good' | 'warning' | 'alert';
/** `drop-in`: booked for one class date (Phase 2). `missed2`: the last two marks in the class were Absent (teacher app). */
export type BadgeKey = 'medical' | 'pickup' | 'no-photos' | 'new' | 'trial' | 'drop-in' | 'missed2' | 'birthday';
export type Badge = { key: BadgeKey; label: string; tone: BadgeTone };

export interface BadgeInput {
  hasAllergies: boolean;
  hasMedicalNotes: boolean;
  /** A pickup note on the child, or a restricted list of who may pick up. */
  hasPickupNote: boolean;
  restrictedPickup?: boolean;
  photoConsent: boolean | null;
  /** When the child's first enrollment (any class, any status but cancelled) was created. */
  firstEnrolledAt: Date | null;
  /** This enrollment is a free trial class. */
  trial: boolean;
  /** On the roster for one date only, as a drop-in (teacher app). */
  dropIn?: boolean;
  /** Absent at the last two class dates marked (teacher app's attendance). */
  missedLastTwo?: boolean;
  /** YYYY-MM-DD */
  birthdate: string | null;
}

const DAY = 86_400_000;
const NEW_DAYS = 30;
const BIRTHDAY_DAYS = 3;

const utc = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Days from today to the nearest birthday (negative: it was a few days ago). February 29 falls on the 28th in other years. */
export function daysToBirthday(birthdate: string, today: string) {
  const [, bm, bd] = birthdate.split('-').map(Number);
  const [ty] = today.split('-').map(Number);
  const t = utc(today);
  let best = Infinity;
  for (const y of [ty - 1, ty, ty + 1]) {
    const day = bm === 2 && bd === 29 && !isLeap(y) ? 28 : bd;
    const diff = Math.round((Date.UTC(y, bm - 1, day) - t) / DAY);
    if (Math.abs(diff) < Math.abs(best)) best = diff;
  }
  return best;
}

/** The badges for one child in one class, in a fixed order. `today` is YYYY-MM-DD in Athens. */
export function childBadges(input: BadgeInput, today: string = todayInAthens()): Badge[] {
  const out: Badge[] = [];
  if (input.hasAllergies || input.hasMedicalNotes) out.push({ key: 'medical', label: input.hasAllergies ? 'Allergy' : 'Medical', tone: 'alert' });
  if (input.hasPickupNote || input.restrictedPickup) out.push({ key: 'pickup', label: 'Pickup note', tone: 'warning' });
  if (input.photoConsent === false) out.push({ key: 'no-photos', label: 'No photos', tone: 'neutral' });
  if (input.firstEnrolledAt) {
    const age = (utc(today) - utc(todayInAthens(input.firstEnrolledAt))) / DAY;
    if (age >= 0 && age <= NEW_DAYS) out.push({ key: 'new', label: 'New', tone: 'good' });
  }
  if (input.trial) out.push({ key: 'trial', label: 'Trial', tone: 'neutral' });
  if (input.dropIn) out.push({ key: 'drop-in', label: 'Drop-in', tone: 'neutral' });
  if (input.missedLastTwo) out.push({ key: 'missed2', label: 'Missed the last two', tone: 'warning' });
  if (input.birthdate && Math.abs(daysToBirthday(input.birthdate, today)) <= BIRTHDAY_DAYS) out.push({ key: 'birthday', label: 'Birthday', tone: 'good' });
  return out;
}
