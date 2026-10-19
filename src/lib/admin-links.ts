/**
 * Every staff address, in one place (docs/back-office.md). Staff pages link
 * with these functions, never with typed paths, so a page can move without
 * breaking links.
 *
 * Ids are database or catalog ids, never names: children's details never go
 * in a URL (docs/security.md).
 */

const seg = (id: string) => encodeURIComponent(id);
const query = (params: Record<string, string | undefined>) => {
  const q = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1])).toString();
  return q ? `?${q}` : '';
};

/** Today: the staff home page. */
export const today = () => '/admin';
/** Everything that needs a person: failed payments, waitlists, missing details. */
export const attention = () => '/admin/attention';

export const classes = () => '/admin/classes';
export const classPage = (sessionId: string) => `/admin/classes/${seg(sessionId)}`;
export const classPrint = (sessionId: string) => `/admin/classes/${seg(sessionId)}/print`;
export const classEmail = (sessionId: string) => `/admin/classes/${seg(sessionId)}/email`;
/** A class's printable sign-in sheet (a PDF download: names and the next class dates, no care details). */
export const classSignInSheet = (sessionId: string) => `/admin/classes/${seg(sessionId)}/sign-in-sheet.pdf`;

export const search = (q?: string) => `/admin/search${query({ q: q?.trim() || undefined })}`;
export const family = (householdId: string) => `/admin/families/${seg(householdId)}`;
export const familyEmail = (householdId: string) => `/admin/families/${seg(householdId)}/email`;
/** The family downloads besides the Family List (which is downloads(search())): pass one to downloads(). */
export const familyLists = () => ({ children: `${search()}/children`, contacts: `${search()}/contacts`, notes: `${search()}/notes` }) as const;

/** Payments: everything, or one section. `month` ("2026-10") picks the month of Payments received. */
export const payments = (show?: 'failed' | 'upcoming', month?: string) => `/admin/payments${query({ show, month })}`;
export const paymentsOrder = (orderId: string) => `/admin/payments/${seg(orderId)}`;

/** The calendar: every class, event and day off. `month` ("2026-11"); the page also takes view=week&week=, and filters. */
export const calendar = (month?: string, params: Record<string, string | undefined> = {}) => `/admin/calendar${query({ month, ...params })}`;
/** One class date's attendance roster, in the teacher app (calendar links to it). */
export const classDayRoster = (sessionId: string, date: string) => `/admin/teach/${seg(sessionId)}/${seg(date)}`;

/** Messages & sign-ups from the site's forms. */
export const leads = () => '/admin/leads';
/** The website editor. */
export const content = () => '/admin/content';
/** Settings: staff and teachers now; email wording and reasons later (docs/back-office.md → Settings). */
export const settings = () => '/admin/settings';
/** Settings → Staff: who works here, their role, their classes and substitute dates. */
export const settingsStaff = () => '/admin/settings/staff';
/** Settings → Days off: the list, and Add a day off (`sessionId` pre-fills one class). */
export const settingsDaysOff = (sessionId?: string) => `/admin/settings/days-off${query({ class: sessionId, which: sessionId ? 'some' : undefined })}`;
/** One staff member: name and role, classes, substitute dates, deactivate. */
export const settingsStaffMember = (staffId: string) => `/admin/settings/staff/${seg(staffId)}`;
/** The teacher app's home: today's classes for a teacher (owners can open it too). */
export const teachHome = () => '/admin/teach';
/** How to put the staff app on a phone's home screen. */
export const install = () => '/admin/install';
/** Sign in again before a download or another sensitive step, then go on to `next`. */
export const confirm = (next: string) => `/admin/confirm${query({ next: safeStaffPath(next) ?? today() })}`;

/** A list page's downloads: /admin/x → /admin/x.csv and /admin/x.pdf, keeping its filters. */
export function downloads(listPath: string) {
  const url = new URL(listPath, 'http://staff.invalid');
  const base = url.pathname.replace(/\/$/, '');
  return { csv: `${base}.csv${url.search}`, pdf: `${base}.pdf${url.search}` };
}

/**
 * `next` as a staff path on this site (/admin or below), or null. Used for
 * every return address the browser hands us, so sign-in can't send staff to
 * another site or to a family page.
 */
export function safeStaffPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || /[\\\s]/.test(next)) return null;
  let url: URL;
  try {
    url = new URL(next, 'http://staff.invalid');
  } catch {
    return null;
  }
  if (url.origin !== 'http://staff.invalid') return null;
  if (!/^\/admin(?:\/|$)/.test(url.pathname)) return null;
  // Nothing that could climb out of /admin after decoding.
  let decoded: string;
  try {
    decoded = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (/(^|\/)\.\.?(\/|$)/.test(decoded)) return null;
  return url.pathname + url.search;
}
