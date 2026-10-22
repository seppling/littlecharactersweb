/**
 * The teacher app on the phone (docs/back-office.md → The teacher app):
 * attendance taps are saved on the phone first (IndexedDB), each with an id
 * made here, then sent to /api/teach/sync when there's signal. Nothing a
 * teacher taps is lost to a bad connection.
 *
 * - Sending: on each tap, when the app opens or comes back to the front, on
 *   the `online` event, every 20 seconds while something waits, and from the
 *   service worker's Background Sync where the browser has it (Android).
 * - Who: each tap carries the signed-in person's id. Only that person's
 *   session sends it; someone else signing in on the phone never does.
 * - The cache (public/admin/teach-sw.js) and the last marks seen here are
 *   cleared on sign-out, when another person signs in, and the next day.
 *   Unsent taps stay until they're sent (up to the 7-day late window).
 *
 * Stored here: ids (class, date, child), the mark, the absence reason, the teacher's short note.
 * Never names or care details, and nothing about signing in.
 */

export const CACHE = 'lc-teach-v1';
const DB = 'lc-teach';
const LATE_DAYS = 8;

export type Mark = 'present' | 'absent' | 'late' | 'left_early';

export interface QueuedTap {
  kind: 'tap';
  clientId: string;
  by: string;
  on: string;
  sessionId: string;
  date: string;
  studentId: string;
  status: Mark;
  note: string;
  /** Why absent (Settings → Reasons); taps queued before reasons have none. */
  reason?: string;
  markedAt: string;
}
export interface QueuedReport {
  kind: 'report';
  clientId: string;
  by: string;
  on: string;
  sessionId: string;
  date: string;
  note: string;
  at: string;
}
export type Queued = QueuedTap | QueuedReport;

/** The newest mark seen on this phone for a child, sent or not, so a page opened from the cache shows it. */
export interface KnownMark {
  key: string;
  by: string;
  status: Mark;
  note: string;
  reason?: string;
  markedAt: string;
  /** Athens day it was saved here: cleared the next day. */
  day: string;
}

export const athensDay = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
export const markKey = (sessionId: string, date: string, studentId: string) => `${sessionId} ${date} ${studentId}`;
export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

// ───────────── IndexedDB ─────────────

let opened: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  opened ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('queue')) d.createObjectStore('queue', { keyPath: 'clientId' });
      if (!d.objectStoreNames.contains('marks')) d.createObjectStore('marks', { keyPath: 'key' });
      if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return opened;
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return db().then(
    (d) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = d.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req ? req.result : undefined);
        tx.onerror = () => reject(tx.error);
      }),
  );
}

export const allQueued = async () => ((await run<Queued[]>('queue', 'readonly', (s) => s.getAll())) ?? []) as Queued[];
export const allMarks = async () => ((await run<KnownMark[]>('marks', 'readonly', (s) => s.getAll())) ?? []) as KnownMark[];
const put = (store: string, value: unknown, key?: IDBValidKey) => run(store, 'readwrite', (s) => s.put(value, key));
const del = (store: string, key: IDBValidKey) => run(store, 'readwrite', (s) => s.delete(key));
const clearStore = (store: string) => run(store, 'readwrite', (s) => s.clear());
const getMeta = (key: string) => run<unknown>('meta', 'readonly', (s) => s.get(key));

/** Saves a tap or a submission on the phone. It's sent by sync(). */
export async function enqueue(item: Queued) {
  await put('queue', item);
  if (item.kind === 'tap') {
    await put('marks', { key: markKey(item.sessionId, item.date, item.studentId), by: item.by, status: item.status, note: item.note, reason: item.reason ?? '', markedAt: item.markedAt, day: athensDay() } satisfies KnownMark);
  }
  // Android: the browser sends it even if the app is closed first.
  try {
    const reg = await navigator.serviceWorker?.ready;
    await (reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } })?.sync?.register('teach-sync');
  } catch {
    /* Background Sync isn't everywhere (iPhones): the foreground retries cover it. */
  }
}

// ───────────── The cache, and whose it is ─────────────

/** Clears what this phone keeps for the teacher app: the cached pages and the marks seen. Unsent taps stay. */
export async function clearCache() {
  try {
    if ('caches' in window) await caches.delete(CACHE);
  } catch {
    /* nothing cached */
  }
  try {
    await clearStore('marks');
    await del('meta', 'who');
  } catch {
    /* no database yet */
  }
}

/**
 * Who's using the app on this phone. When someone else signs in, the cache
 * and the marks seen are cleared first. The next day, the marks seen are too.
 */
export async function claimPhone(by: string) {
  const who = await getMeta('who');
  if (who && who !== by) await clearCache();
  await put('meta', by, 'who');
  const today = athensDay();
  for (const m of await allMarks()) if (m.day !== today) await del('marks', m.key);
  // Unsent taps older than the late window can't be saved any more.
  const oldest = Date.now() - LATE_DAYS * 86_400_000;
  for (const q of await allQueued()) if (Date.parse(q.kind === 'tap' ? q.markedAt : q.at) < oldest) await del('queue', q.clientId);
}

/**
 * Starts the service worker and asks it to keep `precache` (today's rosters)
 * and, when `keepThis` (the page sent X-Teach-Cache), this page too. A page
 * that may not be kept isn't fetched again for nothing.
 */
export function registerWorker(precache: string[] = [], keepThis = false) {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker
    .register('/admin/teach-sw.js', { scope: '/admin/teach' })
    .then(() => navigator.serviceWorker.ready)
    .then((reg) => {
      // The page's own files (scripts, styles, fonts), so it opens with no signal.
      const assets = performance
        .getEntriesByType('resource')
        .map((e) => e.name)
        .filter((u) => u.startsWith(location.origin) && /\/(_astro|fonts|admin\/icons)\/|\.(woff2?|css|js)$/.test(new URL(u).pathname));
      reg.active?.postMessage({ type: 'precache', pages: keepThis ? [location.pathname + location.search, ...precache] : precache, assets });
    })
    .catch(() => {
      /* No service worker (a private window): the app still works online. */
    });
}

// ───────────── Sending ─────────────

export type SyncState = 'sent' | 'waiting' | 'sending' | 'signed-out' | 'other-person';
export interface SyncOutcome {
  state: SyncState;
  /** Taps and submissions the server refused (a day off, a date closed), and why. */
  refused: { item: Queued; why: string }[];
  /** Taps and submissions saved (or already there) in this round. */
  done: Queued[];
}

let inFlight: Promise<SyncOutcome> | null = null;

/** Sends this person's waiting taps, then their submissions. Safe to call often. */
export function sync(by: string): Promise<SyncOutcome> {
  inFlight ??= send(by).finally(() => (inFlight = null));
  return inFlight;
}

async function send(by: string): Promise<SyncOutcome> {
  const mine = (await allQueued()).filter((q) => q.by === by);
  if (!mine.length) return { state: 'sent', refused: [], done: [] };
  if (!navigator.onLine) return { state: 'waiting', refused: [], done: [] };
  // A test day (development only) travels with the taps made on it.
  const on = mine[0].on;
  const batch = mine.filter((q) => q.on === on);
  const body = {
    by,
    taps: batch.filter((q): q is QueuedTap => q.kind === 'tap').map(({ clientId, sessionId, date, studentId, status, note, reason, markedAt }) => ({ clientId, sessionId, date, studentId, status, note, reason: reason ?? '', markedAt })),
    reports: batch.filter((q): q is QueuedReport => q.kind === 'report').map(({ clientId, sessionId, date, note, at }) => ({ clientId, sessionId, date, note, at })),
  };
  let res: Response;
  try {
    res = await fetch(`/api/teach/sync${on ? `?on=${encodeURIComponent(on)}` : ''}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' });
  } catch {
    return { state: 'waiting', refused: [], done: [] };
  }
  if (res.status === 401) return { state: 'signed-out', refused: [], done: [] };
  if (res.status === 409) return { state: 'other-person', refused: [], done: [] };
  if (!res.ok) return { state: 'waiting', refused: [], done: [] };
  const { results } = (await res.json()) as { results: { clientId: string; result: string; why?: string }[] };
  const byId = new Map(batch.map((q) => [q.clientId, q]));
  const refused: SyncOutcome['refused'] = [];
  const done: Queued[] = [];
  for (const r of results) {
    const item = byId.get(r.clientId);
    if (!item) continue;
    await del('queue', r.clientId);
    if (r.result === 'refused') refused.push({ item, why: r.why ?? '' });
    else done.push(item);
  }
  const left = (await allQueued()).filter((q) => q.by === by);
  return { state: left.length ? 'waiting' : 'sent', refused, done };
}

/** Sends now, and again whenever the app comes back to the front, the signal returns, or every 20 seconds while something waits. */
export function keepSending(by: string, onResult: (o: SyncOutcome) => void) {
  const go = async () => {
    const pending = (await allQueued()).some((q) => q.by === by);
    if (pending) onResult({ state: navigator.onLine ? 'sending' : 'waiting', refused: [], done: [] });
    onResult(await sync(by));
  };
  addEventListener('online', go);
  addEventListener('offline', () => void go());
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && go());
  navigator.serviceWorker?.addEventListener('message', (e) => e.data?.type === 'synced' && go());
  setInterval(async () => {
    if ((await allQueued()).some((q) => q.by === by)) go();
  }, 20_000);
  return go;
}

/**
 * Sign-out from any staff page clears the teacher app's cache on this phone
 * (AdminShell calls it). The form goes on at once; the staff sign-in it lands
 * on clears again once loaded (clearWhenSignedOut), in case leaving the page
 * cut this short.
 */
export function clearOnSignOut() {
  for (const form of document.querySelectorAll<HTMLFormElement>('form[action="/account/sign-out"]')) {
    form.addEventListener('submit', () => {
      navigator.serviceWorker?.controller?.postMessage({ type: 'clear' });
      void clearCache();
    });
  }
}

/** The staff sign-in is showing: nobody is signed in here, so nothing of the teacher app stays on the phone. */
export function clearWhenSignedOut() {
  if (document.querySelector('[data-staff-signin]')) void clearCache();
}
