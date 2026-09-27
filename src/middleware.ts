/**
 * Runs on every on-demand (server-rendered) request: loads the signed-in
 * family, and adds security headers. Prerendered marketing pages skip it; their
 * headers come from the host config (public/_headers / vercel.json).
 */
import { defineMiddleware } from 'astro:middleware';
import { getAuth, isAdmin } from '@/server/auth';
import { assertProductionConfig } from '@/server/env';

/** A readable, non-sensitive hint so static pages know to ask /api/me who's signed in. */
const HINT_COOKIE = 'lc_signed_in';

const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://js.stripe.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://*.stripe.com",
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

export const onRequest = defineMiddleware(async (ctx, next) => {
  if (ctx.isPrerendered) return next();
  assertProductionConfig();

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

  const response = await next();
  const out = new Response(response.body, response);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
  // Portal pages show family data: never let shared caches keep them.
  if (!ctx.url.pathname.startsWith('/_astro')) out.headers.set('Cache-Control', 'private, no-store');
  return out;
});
