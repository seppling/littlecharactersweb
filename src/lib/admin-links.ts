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
/** A class's drop-ins: the Drop-ins part of its page; pass to downloads() for the CSV and PDF (docs/back-office.md → Drop-ins). */
export const classDropIns = (sessionId: string) => `/admin/classes/${seg(sessionId)}/drop-ins`;
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
/** One class date in the teacher app: the roster and attendance. `on` carries a test day (development only). */
export const teachRoster = (sessionId: string, date: string, on?: string | null) => `/admin/teach/${seg(sessionId)}/${seg(date)}${query({ on: on ?? undefined })}`;
/** The teacher app's Me tab: sign out, shared devices, the app on your phone. */
export const teachMe = () => '/admin/teach/me';
/** A class's attendance downloads: pass to downloads() (CSV and PDF, a column per class date). */
export const classAttendance = (sessionId: string) => `/admin/classes/${seg(sessionId)}/attendance`;
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

// ───────────── Tags, skills and progress notes (docs/back-office.md → Tags and skills) ─────────────

/** Settings → Tags: every child and family tag, with add, rename, delete, email and downloads. */
export const settingsTags = () => '/admin/settings/tags';
/** One tag's list: pass to downloads() for its CSV and PDF; the page itself opens the tag's search results. */
export const tagList = (tagId: string) => `/admin/settings/tags/${seg(tagId)}`;
/** Email a tag: the families of the children (or the families) carrying it. */
export const tagEmail = (tagId: string) => `/admin/settings/tags/${seg(tagId)}/email`;
/** Search by tag: the children or families carrying it, with their classes. */
export const searchTag = (tagId: string) => `/admin/search${query({ tag: tagId })}`;
/** Where the family page's tag forms post (add and remove, for the family and each child). */
export const familyTags = (householdId: string) => `/admin/families/${seg(householdId)}/tags`;
/** Where a class roster's "Tag selected" posts. */
export const classTags = (sessionId: string) => `/admin/classes/${seg(sessionId)}/tags`;
/** Settings → Skills: each program's skills in order (`program` opens one). */
export const settingsSkills = (programSlug?: string) => `/admin/settings/skills${query({ program: programSlug })}`;
/** A class's skills grid: pass to downloads() for the "Class Skills Worksheet" CSV and PDF; the page itself is the class page's Skills part. */
export const classSkills = (sessionId: string) => `/admin/classes/${seg(sessionId)}/skills`;
/** The teacher app's Skills view for one class date, beside its attendance. */
export const teachSkills = (sessionId: string, date: string, on?: string | null) => `/admin/teach/${seg(sessionId)}/${seg(date)}/skills${query({ on: on ?? undefined })}`;
/** A progress note: write, preview and send a draft, or see one that was sent. */
export const progressNote = (noteId: string) => `/admin/progress-notes/${seg(noteId)}`;
/** Write a new progress note about a child (and a class). `back` is where Cancel and Send return to. */
export const newProgressNote = (studentId: string, sessionId?: string, back?: string) =>
  `/admin/progress-notes/new${query({ student: studentId, class: sessionId, back: back ? (safeStaffPath(back) ?? undefined) : undefined })}`;
