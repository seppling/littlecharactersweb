/**
 * Server configuration, read from environment variables in one place.
 * See .env.example for the full list. Nothing here is ever sent to the browser
 * except values prefixed PUBLIC_.
 */
const env = process.env;

/**
 * Fail closed: we treat every environment as production (no test payments,
 * real email required, all secrets required) unless it's the Astro dev server
 * or APP_ENV=development is set explicitly.
 */
export const isProd = !(import.meta.env?.DEV || env.APP_ENV === 'development');

export const config = {
  /** The site's public address. Falls back to the preview URL Render provides. */
  siteUrl: env.SITE_URL || env.RENDER_EXTERNAL_URL || 'http://localhost:4321',

  /** Postgres connection string (Neon, Supabase, RDS…). Empty = embedded PGlite for local dev. */
  databaseUrl: env.DATABASE_URL ?? '',
  /** Where embedded PGlite keeps its files in dev. "memory://" for tests. */
  pgliteDir: env.PGLITE_DIR ?? '.data/pglite',

  authSecret: env.BETTER_AUTH_SECRET ?? '',
  /** Comma-separated emails that get the admin roster. */
  adminEmails: (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),

  /** AES-256 key (base64, 32 bytes) for encrypting medical/allergy notes at rest. */
  dataEncryptionKey: env.DATA_ENCRYPTION_KEY ?? '',

  stripeSecretKey: env.STRIPE_SECRET_KEY ?? '',
  stripePublishableKey: env.PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
  stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET ?? '',

  /** Shared secret the daily scheduler sends to /api/billing/run. */
  cronSecret: env.CRON_SECRET ?? '',

  resendApiKey: env.RESEND_API_KEY ?? '',
  emailFrom: env.EMAIL_FROM ?? 'Little Characters <hello@littlecharacters.org>',
  /** Where replies to our emails go. */
  emailReplyTo: env.EMAIL_REPLY_TO ?? 'littlecharacterstheater@gmail.com',
};

/** Payments run through Stripe when keys are present; otherwise a local test stand-in (never in production). */
export const paymentsMode: 'stripe' | 'test' = config.stripeSecretKey ? 'stripe' : 'test';

let checked = false;
export function assertProductionConfig() {
  if (!isProd || checked) return;
  const missing = [
    ['DATABASE_URL', config.databaseUrl],
    ['BETTER_AUTH_SECRET', config.authSecret],
    ['DATA_ENCRYPTION_KEY', config.dataEncryptionKey],
    ['STRIPE_SECRET_KEY', config.stripeSecretKey],
    ['STRIPE_WEBHOOK_SECRET', config.stripeWebhookSecret],
    ['RESEND_API_KEY', config.resendApiKey],
    ['CRON_SECRET', config.cronSecret],
  ].filter(([, v]) => !v);
  if (missing.length) {
    throw new Error(`Missing required production settings: ${missing.map(([k]) => k).join(', ')}`);
  }
  checked = true;
}
