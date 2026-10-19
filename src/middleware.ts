/**
 * Runs on every request: loads the site content (cached; see
 * src/server/content.ts), loads the signed-in family where a page needs it,
 * and adds security and caching headers.
 *
 * Public pages are the same for everyone, so they don't look up who's signed
 * in; the header fills in a family's name from /api/me. The exception is
 * staff previewing unpublished edits, who get a private copy.
 */
import { defineMiddleware } from 'astro:middleware';
import { getAuth, isAdmin } from '@/server/auth';
import { assertProductionConfig } from '@/server/env';
import { getContent } from '@/server/content';
import { PREVIEW_COOKIE } from '@/lib/editor';
import { oldSiteRedirect } from '@/lib/redirects';
import { isLiveHost } from '@/lib/seo';
import { hasShowPage } from '@/lib/events';

/** A readable, non-sensitive hint so public pages know to ask /api/me who's signed in. */
const HINT_COOKIE = 'lc_signed_in';

const PORTAL = /^\/(account|enroll|admin|api|dev)(\/|$)/;

const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://js.stripe.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.stripe.com",
    "font-src 'self' data:",
    "connect-src 'self' https://api.stripe.com https://checkout.stripe.com",
    'frame-src https://js.stripe.com https://checkout.stripe.com https://hooks.stripe.com',
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join('; '),
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com")',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
};

const permanentRedirect = (location: string) =>
  new Response(null, { status: 301, headers: { Location: location, 'Cache-Control': 'public, max-age=86400' } });

export const onRequest = defineMiddleware(async (ctx, next) => {
  if (ctx.isPrerendered) return next();
  const path = ctx.url.pathname;
  const indexable = isLiveHost(ctx.url.hostname);
  // Addresses from the old site (Squarespace) go to their new pages, for good.
  // Event addresses wait for the content, which says which shows have a page.
  const eventPath = path.startsWith('/events/');
  const moved = eventPath ? undefined : oldSiteRedirect(path);
  if (moved) return permanentRedirect(moved);
  // Uploaded photos: served as-is, cached for good by the route itself.
  if (path.startsWith('/media/')) {
    const response = await next();
    response.headers.set('X-Content-Type-Options', 'nosniff');
    if (!indexable) response.headers.set('X-Robots-Tag', 'noindex');
    return response;
  }
  assertProductionConfig();

  const portal = PORTAL.test(path);
  const wantsPreview = ctx.cookies.get(PREVIEW_COOKIE)?.value === '1';
  ctx.locals.user = null;
  ctx.locals.session = null;
  ctx.locals.isAdmin = false;

  if (portal || wantsPreview) {
    const auth = await getAuth();
    const result = await auth.api.getSession({ headers: ctx.request.headers });
    ctx.locals.user = result?.user ?? null;
    ctx.locals.session = result?.session ?? null;
    ctx.locals.isAdmin = isAdmin(result?.user);

    if (result?.user && !ctx.cookies.has(HINT_COOKIE)) {
      ctx.cookies.set(HINT_COOKIE, '1', { path: '/', sameSite: 'lax', maxAge: 90 * 86_400, secure: ctx.url.protocol === 'https:' });
    } else if (!result?.user && ctx.cookies.has(HINT_COOKIE)) {
      ctx.cookies.delete(HINT_COOKIE, { path: '/' });
    }
  }

  ctx.locals.preview = wantsPreview && ctx.locals.isAdmin;
  ctx.locals.content = await getContent(ctx.locals.preview ? 'draft' : 'live');
  if (eventPath) {
    const { events } = ctx.locals.content;
    const movedEvent = oldSiteRedirect(path, (slug) => events.some((e) => e.slug === slug && hasShowPage(e)));
    if (movedEvent) return permanentRedirect(movedEvent);
  }

  const response = await next();
  const out = new Response(response.body, response);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
  // Previews and the private address before launch stay out of search results.
  if (!indexable) out.headers.set('X-Robots-Tag', 'noindex, nofollow');
  if (portal || ctx.locals.preview) {
    // Portal pages show family data, and previews show unpublished edits: never let shared caches keep them.
    out.headers.set('Cache-Control', 'private, no-store');
  } else if (!out.headers.has('Cache-Control')) {
    // Public pages: always check for the latest content.
    out.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  }
  return out;
});
