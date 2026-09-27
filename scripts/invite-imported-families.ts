/**
 * Email imported Studio Director families that their new account is ready.
 *
 *   npm run invite:imported                 # preview: how many would be emailed
 *   npm run invite:imported -- --send 25    # send to the next 25
 *
 * Each parent is emailed once (recorded in the audit log), and only while they
 * haven't signed in yet. This is an account notice to existing customers, not
 * marketing: it has no promotions, and says how to ask us to delete the account.
 */
import { config } from '../src/server/env';
import { emailHtml, sendEmail } from '../src/server/email';
import { recordInvite, uninvitedImportedGuardians } from '../src/server/studio-director';

const i = process.argv.indexOf('--send');
const limit = i > 0 ? Number(process.argv[i + 1] ?? 0) : 0;
if (i > 0 && !(limit > 0)) {
  console.error('Usage: npm run invite:imported -- --send <how many>');
  process.exit(1);
}

const pending = await uninvitedImportedGuardians();
console.log(`${pending.length} imported parent${pending.length === 1 ? '' : 's'} not yet invited.`);
if (!limit) {
  console.log('Preview only. Run with --send <n> to email the next n.');
  process.exit(0);
}

const account = new URL('/account', config.siteUrl).toString();
let sent = 0;
for (const g of pending.slice(0, limit)) {
  const first = g.name.split(' ')[0];
  const paragraphs = [
    `${first ? `Hi ${first}, we’ve` : 'We’ve'} moved Little Characters registration off Studio Director and onto our own website. Your family and students are already set up.`,
    `To sign in, go to ${account} and enter this email address. We’ll send you a 6-digit code (no password to remember), and you’ll stay signed in on that device.`,
    'Please take a minute to check your students’ birthdays, allergies and pickup notes before the next class.',
    'Didn’t expect this, or want your information removed? Just reply to this email and we’ll take care of it.',
  ];
  await sendEmail({
    to: g.email,
    subject: 'Your Little Characters family account is ready',
    text: paragraphs.join('\n\n'),
    html: emailHtml('Your family account is ready', paragraphs),
  });
  await recordInvite(g.id);
  sent++;
  await new Promise((r) => setTimeout(r, 250)); // stay well under the email provider's rate limit
}
console.log(`Sent ${sent}. ${pending.length - sent} left.`);
process.exit(0);
