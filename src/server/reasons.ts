/**
 * Drop and absence reasons (Settings → Reasons; docs/back-office.md →
 * Settings). Two short lists Hannah edits: why a child left a class (asked by
 * Remove on the class page, saved in `enrollment.drop_reason`) and why a child
 * was absent (one optional tap in the teacher app, saved in
 * `attendance.reason`). Records keep the words they were saved with: renaming
 * or removing a reason here changes nothing already saved.
 *
 * Saved as `reasons.drop` and `reasons.absence` (src/server/settings-store.ts);
 * unsaved, the lists below.
 */
import { clearSetting, getSetting, setSetting } from './settings-store';

export type ReasonKind = 'drop' | 'absence';

export const DEFAULT_REASONS: Record<ReasonKind, string[]> = {
  drop: ['Schedule', 'Moved', 'Cost', 'Lost interest', 'Other'],
  absence: ['Sick', 'Travel', 'Family', 'Other'],
};

export const REASON_NAME_MAX = 40;
export const REASONS_MAX = 20;
/** The few words after "Other" on Remove. */
export const OTHER_MAX = 120;

export class ReasonError extends Error {}

const key = (kind: ReasonKind) => (kind === 'drop' ? 'reasons.drop' : 'reasons.absence') as 'reasons.drop' | 'reasons.absence';

/** The list Hannah set, else the default. */
export async function reasonList(kind: ReasonKind): Promise<string[]> {
  return (await getSetting(key(kind))) ?? [...DEFAULT_REASONS[kind]];
}

/** "Other" (any capitals) opens a short text on Remove. */
export const isOther = (name: string) => name.trim().toLowerCase() === 'other';

const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function checkName(list: string[], name: string, except?: string) {
  const n = tidy(name);
  if (!n) throw new ReasonError('Write the reason.');
  if (n.length > REASON_NAME_MAX) throw new ReasonError(`Keep it under ${REASON_NAME_MAX} characters.`);
  if (list.some((r) => same(r, n) && !(except && same(r, except)))) throw new ReasonError(`“${n}” is already on the list.`);
  return n;
}

function indexOf(list: string[], name: string) {
  const i = list.findIndex((r) => r === name);
  if (i < 0) throw new ReasonError('That reason isn’t on the list any more.');
  return i;
}

/** Pure edits, each returning the new list. */
export const editReasons = {
  add(list: string[], name: string) {
    if (list.length >= REASONS_MAX) throw new ReasonError(`Up to ${REASONS_MAX} reasons. Remove one first.`);
    return [...list, checkName(list, name)];
  },
  rename(list: string[], from: string, to: string) {
    const i = indexOf(list, from);
    const out = [...list];
    out[i] = checkName(list, to, from);
    return out;
  },
  move(list: string[], name: string, dir: 'up' | 'down') {
    const i = indexOf(list, name);
    const j = dir === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= list.length) return list;
    const out = [...list];
    [out[i], out[j]] = [out[j], out[i]];
    return out;
  },
  remove(list: string[], name: string) {
    indexOf(list, name);
    return list.filter((r) => r !== name);
  },
};

/** Saves a list; the default list, saved as is, clears the setting instead. */
export async function saveReasons(userId: string, kind: ReasonKind, list: string[]) {
  if (list.length === DEFAULT_REASONS[kind].length && list.every((r, i) => r === DEFAULT_REASONS[kind][i])) {
    await clearSetting(userId, key(kind));
    return [...DEFAULT_REASONS[kind]];
  }
  return setSetting(userId, key(kind), list);
}

/**
 * Pure: the drop reason to save from Remove's form, or null. Only a reason on
 * the list counts; "Other" with words becomes "Other: <words>".
 */
export function dropReasonFrom(choice: string, other: string, list: string[]): string | null {
  const c = list.find((r) => r === choice.trim());
  if (!c) return null;
  const words = tidy(other).slice(0, OTHER_MAX);
  return isOther(c) && words ? `${c}: ${words}` : c;
}
