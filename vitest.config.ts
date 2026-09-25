import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    // Each test file gets its own in-memory Postgres (PGlite); nothing touches real data.
    env: { APP_ENV: 'development', DATABASE_URL: '', PGLITE_DIR: 'memory://', ADMIN_EMAILS: 'hannah@example.com', RESEND_API_KEY: '', STRIPE_SECRET_KEY: '' },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
