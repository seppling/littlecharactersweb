#!/usr/bin/env bash
# Start the built server on a fresh local database with one imported
# Studio Director family, for tests/e2e/enroll-journey.mjs. Run `npm run build` first.
set -euo pipefail
cd "$(dirname "$0")/../.."
export APP_ENV=development PGLITE_DIR="${PGLITE_DIR:-.data/e2e}" ADMIN_EMAILS=hannah@example.com CRON_SECRET=e2e-cron-secret
# The journey pays with the local test-payment stand-in, even if Stripe keys are set.
# (Stripe itself was checked in test mode; see docs/portal.md → Tested with Stripe.)
export STRIPE_SECRET_KEY= PUBLIC_STRIPE_PUBLISHABLE_KEY= STRIPE_WEBHOOK_SECRET=
export HOST="${HOST:-127.0.0.1}" PORT="${PORT:-4321}" SITE_URL="http://localhost:${PORT:-4321}"
rm -rf "$PGLITE_DIR"
npx tsx scripts/import-studio-director.ts tests/e2e/fixtures/studio-director-*.csv --commit > /dev/null
exec node dist/server/entry.mjs
