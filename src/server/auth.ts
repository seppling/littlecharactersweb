/**
 * Authentication: passwordless email codes with long-lived sessions.
 *
 * Families type their email, get a 6-digit code, and stay signed in on that
 * device for 90 days (renewed each visit). No passwords to forget. A code is
 * typed in the same tab, so checkout is never interrupted by a trip to email.
 */
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { config, isProd } from './env';
import { getDb, schema } from './db';
import { emailHtml, sendEmail } from './email';

const DAY = 60 * 60 * 24;

async function createAuth() {
  const db = await getDb();
  if (isProd && !config.authSecret) throw new Error('BETTER_AUTH_SECRET is required in production.');

  return betterAuth({
    baseURL: config.siteUrl,
    basePath: '/api/auth',
    secret: config.authSecret || 'dev-only-secret-change-me-dev-only-secret',
    trustedOrigins: [config.siteUrl],
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
    }),
    user: {
      additionalFields: { phone: { type: 'string', required: false, input: false } },
    },
    emailAndPassword: { enabled: false },
    session: {
      expiresIn: 90 * DAY, // stay signed in for 90 days…
      updateAge: DAY, // …renewed at most once a day while in use
      // No cookie cache: profile and household changes show up immediately.
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 60,
      customRules: {
        '/email-otp/send-verification-otp': { window: 60, max: 3 },
        '/sign-in/email-otp': { window: 60, max: 10 },
      },
    },
    advanced: {
      cookiePrefix: 'lc',
      useSecureCookies: config.siteUrl.startsWith('https://'),
      // Hosts (Vercel, Netlify, Fly…) put the visitor's IP here; used for rate limiting.
      ipAddress: { ipAddressHeaders: ['x-forwarded-for', 'x-real-ip', 'fly-client-ip', 'cf-connecting-ip'] },
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 10 * 60,
        allowedAttempts: 5,
        storeOTP: 'hashed',
        async sendVerificationOTP({ email, otp }) {
          await sendEmail({
            to: email,
            subject: `${otp} is your Little Characters sign-in code`,
            text: `Your sign-in code is ${otp}. It expires in 10 minutes. If you didn't ask for this, you can ignore this email.`,
            html: emailHtml('Your sign-in code', ['Type this code on the Little Characters site to continue. It expires in 10 minutes.', 'If you didn’t ask for a code, you can safely ignore this email.'], otp),
          });
        },
      }),
    ],
  });
}

type Auth = Awaited<ReturnType<typeof createAuth>>;
let authPromise: Promise<Auth> | undefined;

export function getAuth(): Promise<Auth> {
  authPromise ??= createAuth();
  return authPromise;
}

export function resetAuthForTests() {
  authPromise = undefined;
}

export function isAdmin(user: { email: string; emailVerified: boolean } | null | undefined) {
  return !!user && user.emailVerified && config.adminEmails.includes(user.email.toLowerCase());
}
