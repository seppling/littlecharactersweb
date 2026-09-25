/**
 * Run monthly autopay by hand (the scheduler normally does this daily):
 *
 *   npm run billing:run                       # charge whatever is due today
 *   npm run billing:run -- --today 2026-10-01  # development only: pretend it's that day
 *
 * Uses DATABASE_URL and STRIPE_SECRET_KEY. Prints counts only.
 */
import { isProd } from '../src/server/env';
import { devCharger, runBilling } from '../src/server/billing';
import { paymentsMode, stripeCharger } from '../src/server/payments';

const i = process.argv.indexOf('--today');
const today = i > 0 ? process.argv[i + 1] : undefined;
if (today && (isProd || !/^\d{4}-\d{2}-\d{2}$/.test(today))) {
  console.error('--today YYYY-MM-DD only works in development (APP_ENV=development).');
  process.exit(1);
}
if (paymentsMode !== 'stripe' && isProd) {
  console.error('STRIPE_SECRET_KEY is not set.');
  process.exit(1);
}
const report = await runBilling({ charge: paymentsMode === 'stripe' ? stripeCharger : devCharger, today });
console.log(report);
process.exit(report.errors ? 1 : 0);
