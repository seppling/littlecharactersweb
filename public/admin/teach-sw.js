/*
 * The teacher app's service worker (docs/back-office.md → The teacher app).
 * Scope: /admin/teach only. The family site and the rest of /admin are never
 * cached.
 *
 * - Pages: from the network first; a copy is kept only when the page says so
 *   (the X-Teach-Cache header: the teacher's home and today's assigned
 *   rosters), so the app opens with no signal. Kept until the end of the day
 *   (the header holds that day), and dropped when a page comes back signed
 *   out or no longer cacheable.
 * - The pages' own files (scripts, styles, fonts, icons): kept once fetched.
 * - Messages from the pages: `precache` (today's rosters and the page's
 *   files), `clear` (sign-out, or another person signing in).
 * - Background Sync (Android): sends the taps waiting in IndexedDB, under the
 *   person who made them. iPhones don't have it; the pages retry instead.
 *
 * Cache keys are addresses (class and date ids), never children's names.
 */
const CACHE = 'lc-teach-v1';
const PAGE_WAIT_MS = 4000;

const athensDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const isPage = (url) => url.pathname === '/admin/teach' || url.pathname.startsWith('/admin/teach/');
const isAsset = (req, url) => ['style', 'script', 'font', 'image', 'manifest'].includes(req.destination) && /^\/(_astro|fonts|admin)\//.test(url.pathname);

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(dropOldDays().then(() => self.clients.claim())));

/** Pages kept on an earlier day are removed. */
async function dropOldDays() {
  const cache = await caches.open(CACHE);
  const today = athensDay();
  for (const req of await cache.keys()) {
    const res = await cache.match(req);
    const day = res && res.headers.get('X-Teach-Cache');
    if (day && day !== today) await cache.delete(req);
  }
}

async function keepPage(req, res) {
  const cache = await caches.open(CACHE);
  if (res.headers.get('X-Teach-Signed-Out')) return caches.delete(CACHE);
  if (res.ok && res.headers.get('X-Teach-Cache') === athensDay()) return cache.put(req, res.clone());
  return cache.delete(req);
}

async function cachedPage(url) {
  const cache = await caches.open(CACHE);
  const res = await cache.match(url, { ignoreVary: true });
  if (!res) return null;
  if (res.headers.get('X-Teach-Cache') !== athensDay()) {
    await cache.delete(url);
    return null;
  }
  return res;
}

const offline = () =>
  new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>No signal</title>' +
      '<body style="font-family:system-ui,sans-serif;padding:2rem 1rem;max-width:30rem;margin:auto;color:#1c1826">' +
      '<h1 style="font-size:1.4rem">No signal</h1><p>This page wasn’t saved on this phone. Today’s classes open without signal once you’ve opened the app today with signal.</p>' +
      '<p><a href="/admin/teach" style="color:#5b2a86;font-weight:700">Back to today’s classes</a></p></body>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );

async function page(event) {
  const req = event.request;
  const network = fetch(req).then(async (res) => {
    await keepPage(req.url, res);
    return res;
  });
  // Bad signal: after a few seconds, show the saved copy (if any) while the network finishes.
  const slow = new Promise((resolve) => setTimeout(resolve, PAGE_WAIT_MS)).then(() => cachedPage(req.url));
  event.waitUntil(network.catch(() => {}));
  try {
    const first = await Promise.race([network, slow]);
    if (first) return first;
    return await network;
  } catch {
    return (await cachedPage(req.url)) || offline();
  }
}

async function asset(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req, { ignoreVary: true, ignoreSearch: false });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) await cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    if (isPage(url)) event.respondWith(page(event));
    return;
  }
  if (isAsset(req, url)) event.respondWith(asset(req));
});

async function precache(pages, assets) {
  const cache = await caches.open(CACHE);
  for (const href of assets || []) {
    try {
      if (!(await cache.match(href))) {
        const res = await fetch(href, { credentials: 'same-origin' });
        if (res.ok) await cache.put(href, res);
      }
    } catch {
      /* try again next time */
    }
  }
  for (const path of pages || []) {
    const url = new URL(path, self.location.origin);
    if (url.origin !== self.location.origin || !isPage(url)) continue;
    try {
      if (await cachedPage(url.href)) continue;
      // Told apart from a teacher opening it, in the audit log.
      const res = await fetch(url.href, { credentials: 'same-origin', headers: { 'X-Teach-Prefetch': '1' } });
      await keepPage(url.href, res);
    } catch {
      /* no signal: try again next time */
    }
  }
}

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'clear') event.waitUntil(caches.delete(CACHE));
  if (data.type === 'precache') event.waitUntil(dropOldDays().then(() => precache(data.pages, data.assets)));
});

// ───── Background Sync (Android): send waiting taps from IndexedDB (src/scripts/teach.ts) ─────

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('lc-teach', 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('queue')) d.createObjectStore('queue', { keyPath: 'clientId' });
      if (!d.objectStoreNames.contains('marks')) d.createObjectStore('marks', { keyPath: 'key' });
      if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function storeOp(d, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = d.transaction('queue', mode);
    const r = fn(tx.objectStore('queue'));
    tx.oncomplete = () => resolve(r ? r.result : undefined);
    tx.onerror = () => reject(tx.error);
  });
}

async function flush() {
  const d = await openDb();
  const items = (await storeOp(d, 'readonly', (s) => s.getAll())) || [];
  // One person and one test day at a time; the server refuses taps made by someone else.
  const groups = new Map();
  for (const q of items) {
    const k = `${q.by} ${q.on || ''}`;
    groups.set(k, [...(groups.get(k) || []), q]);
  }
  let failed = false;
  for (const batch of groups.values()) {
    const { by, on } = batch[0];
    const body = {
      by,
      // The same fields as the page sends (send() in src/scripts/teach.ts), absence reason included.
      taps: batch.filter((q) => q.kind === 'tap').map(({ clientId, sessionId, date, studentId, status, note, reason, markedAt }) => ({ clientId, sessionId, date, studentId, status, note, reason: reason || '', markedAt })),
      reports: batch.filter((q) => q.kind === 'report').map(({ clientId, sessionId, date, note, at }) => ({ clientId, sessionId, date, note, at })),
    };
    const res = await fetch(`/api/teach/sync${on ? `?on=${encodeURIComponent(on)}` : ''}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' });
    if (res.status === 401 || res.status === 409) continue; // signed out, or not theirs: kept for the right person
    if (!res.ok) {
      failed = true;
      continue;
    }
    const { results } = await res.json();
    // Refused ones stay, so the page sends them once more and tells the teacher ("Not saved: … Ask Hannah.").
    for (const r of results) if (r.result !== 'refused') await storeOp(d, 'readwrite', (s) => s.delete(r.clientId));
  }
  for (const c of await self.clients.matchAll()) c.postMessage({ type: 'synced' });
  if (failed) throw new Error('retry');
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'teach-sync') event.waitUntil(flush());
});
