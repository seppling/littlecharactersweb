/**
 * Transactional email (sign-in codes, confirmations).
 * Uses Resend when RESEND_API_KEY is set; otherwise stores the message in the
 * dev mailbox table so you can read it at /dev/mailbox.
 */
import { config, isProd } from './env';
import { getDb, schema } from './db';

export interface Email {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(email: Email) {
  if (config.resendApiKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: config.emailFrom, reply_to: config.emailReplyTo, to: email.to, subject: email.subject, text: email.text, html: email.html }),
    });
    if (!res.ok) throw new Error(`Email failed: ${res.status} ${await res.text()}`);
    return;
  }
  if (isProd) throw new Error('RESEND_API_KEY is required to send email in production.');
  const db = await getDb();
  await db.insert(schema.devEmail).values({ to: email.to, subject: email.subject, text: email.text });
  console.info(`[dev mailbox] to=${email.to} subject="${email.subject}"`);
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** A simple branded wrapper so emails look like they came from the same place as the site. */
export function emailHtml(heading: string, paragraphs: string[], code?: string) {
  return `<!doctype html><html><body style="margin:0;background:#f5f3f8;font-family:Arial,Helvetica,sans-serif;color:#1c1826">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px" cellpadding="0" cellspacing="0"><tr><td>
<p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#662299;font-weight:bold">Little Characters Theater Troupe</p>
<h1 style="margin:0 0 16px;font-size:24px">${escape(heading)}</h1>
${code ? `<p style="margin:0 0 20px;font-size:36px;letter-spacing:8px;font-weight:bold;font-family:'Courier New',monospace">${escape(code)}</p>` : ''}
${paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#4b4558">${escape(p)}</p>`).join('')}
<p style="margin:24px 0 0;font-size:13px;color:#6d6680">1635 W Broad St, Athens, GA 30606 · littlecharacterstheater@gmail.com</p>
</td></tr></table></td></tr></table></body></html>`;
}
