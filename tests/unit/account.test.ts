/**
 * The family account (card on file, autopay by date, the Studio Director
 * welcome, "Looks right", the child's own calendar file), the Give page's
 * donation link, and the old site's addresses.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getDb, schema } from '@/server/db';
import { cardLabel, groupAutopay, namesList, studioDirectorWelcome } from '@/lib/account';
import { classCalendar, firstClassOnOrAfter } from '@/lib/ics';
import { oldSiteRedirect } from '@/lib/redirects';
import { offSiteLink, buildSiteContent } from '@/content/site-content';
import { SELF_LINK, validate, type Field } from '@/content/fields';
import { seedEntries } from '@/content/seed';
import { drafts } from '@/content/seo-draft';
import { cardOnFile } from '@/server/payments';
import { confirmStudentDetails, createStudent, ensureHousehold, getStudent, readStudentNotes, updateStudentDetails, type SessionUser } from '@/server/family';
import { pages } from '@/content/pages';
import type { Session } from '@/content/types';

const noCard = { stripePaymentMethodId: null, cardBrand: null, cardLast4: null, cardExpMonth: null, cardExpYear: null };

describe('card on file', () => {
  it('shows brand, last four and expiry, and nothing without a saved card', () => {
    expect(cardLabel(noCard)).toBeNull();
    expect(cardLabel({ ...noCard, stripePaymentMethodId: 'pm_1', cardBrand: 'visa', cardLast4: '4242', cardExpMonth: 4, cardExpYear: 2030 })).toBe('Visa ending 4242, expires 4/2030');
    expect(cardLabel({ ...noCard, stripePaymentMethodId: 'pm_1', cardBrand: 'amex', cardLast4: '0005', cardExpMonth: 12, cardExpYear: 2029 })).toBe('American Express ending 0005, expires 12/2029');
  });
  it('says "Test card" for the local stand-in, and stays vague for cards saved before details were kept', () => {
    expect(cardLabel({ ...noCard, stripePaymentMethodId: 'test_card' })).toBe('Test card');
    expect(cardLabel({ ...noCard, stripePaymentMethodId: 'pm_old' })).toBe('Card saved at checkout');
  });
  it('keeps only brand, last four and expiry from Stripe’s card', () => {
    const pm = { card: { brand: 'mastercard', last4: '4444', exp_month: 1, exp_year: 2031, fingerprint: 'fp', funding: 'credit', country: 'US' } };
    expect(cardOnFile(pm as never)).toEqual({ cardBrand: 'mastercard', cardLast4: '4444', cardExpMonth: 1, cardExpYear: 2031 });
    expect(cardOnFile(null)).toEqual({ cardBrand: null, cardLast4: null, cardExpMonth: null, cardExpYear: null });
  });
});

describe('upcoming autopay by date', () => {
  const kids: Record<string, string[]> = { o1: ['Kai'], o2: ['Ava'], o3: ['Kai', 'Ava'] };
  it('totals each date and names each child’s share', () => {
    const groups = groupAutopay(
      [
        { orderId: 'o2', dueDate: '2026-11-01', amountCents: 8075 },
        { orderId: 'o1', dueDate: '2026-11-01', amountCents: 9500 },
        { orderId: 'o1', dueDate: '2026-12-01', amountCents: 9500 },
      ],
      (p) => kids[p.orderId],
    );
    expect(groups.map((g) => g.summary)).toEqual(['Nov 1: $175.75 · Ava $80.75, Kai $95', 'Dec 1: $95 · Kai $95']);
    expect(groups[0].items.map((i) => i.who)).toEqual(['Ava', 'Kai']);
  });
  it('adds up one child’s classes on the same date, and names siblings who share a payment', () => {
    const [g] = groupAutopay(
      [
        { orderId: 'o1', dueDate: '2026-11-01', amountCents: 9500 },
        { orderId: 'o1', dueDate: '2026-11-01', amountCents: 8000 },
        { orderId: 'o3', dueDate: '2026-11-01', amountCents: 16150 },
      ],
      (p) => kids[p.orderId],
    );
    expect(g.summary).toBe('Nov 1: $336.50 · Kai $175, Kai and Ava $161.50');
  });
  it('lists names', () => {
    expect(namesList(['Kai'])).toBe('Kai');
    expect(namesList(['Kai', 'Ava', 'Leo'])).toBe('Kai, Ava and Leo');
  });
});

describe('Studio Director welcome', () => {
  it('leaves the date out until Hannah sets it', () => {
    expect(studioDirectorWelcome()).toBe('Your fall classes and payments stay in Studio Director until the term ends. Spring sign-up happens here. Please check your family details and each child’s details below.');
    expect(studioDirectorWelcome('2026-12-18')).toContain('until the term ends on December 18.');
  });
  it('is a site setting, empty by default', () => {
    const content = buildSiteContent(seedEntries().map((e, i) => ({ ...e, position: i, data: e.data })));
    expect(content.site.studioDirectorBillingEnds).toBeUndefined();
  });
});

describe('calendar files', () => {
  const session = { id: 'intro-f26-tue', days: ['Tue'], start: '16:30', end: '17:30', startDate: '2026-08-17', endDate: '2026-12-18' } as Session;
  const base = { session, uid: 'x', prodId: '-//LC//EN', summary: 'Ava: Intro to Theater', description: 'd', now: new Date('2026-10-13T12:00:00Z') };
  it('starts at the child’s first class, not the session’s first day', () => {
    expect(firstClassOnOrAfter(session, '2026-08-17')).toBe('2026-08-18');
    // Joined on Wednesday Oct 14: the first class is Tuesday Oct 20.
    const first = firstClassOnOrAfter(session, '2026-10-14')!;
    expect(first).toBe('2026-10-20');
    const ics = classCalendar({ ...base, first, reminderMinutes: 60 });
    expect(ics).toContain('DTSTART;TZID=America/New_York:20261020T163000');
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=TU;UNTIL=20261218T235959Z');
    expect(ics).toContain('SUMMARY:Ava: Intro to Theater');
    expect(ics).toContain('BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Ava: Intro to Theater\r\nTRIGGER:-PT60M\r\nEND:VALARM');
  });
  it('has no more dates once the class is over', () => {
    expect(firstClassOnOrAfter(session, '2026-12-19')).toBeUndefined();
  });
  it('keeps the public file as it was: from the first day, no reminder', () => {
    const ics = classCalendar({ ...base, first: firstClassOnOrAfter(session, session.startDate)! });
    expect(ics).toContain('DTSTART;TZID=America/New_York:20260818T163000');
    expect(ics).not.toContain('VALARM');
  });
});

describe('Give page link', () => {
  it('has no donation link or tax note until Hannah adds them', () => {
    const content = buildSiteContent(seedEntries().map((e, i) => ({ ...e, position: i, data: e.data })));
    expect(content.site.givingUrl).toBeUndefined();
    expect(content.site.givingTaxNote).toBeUndefined();
    expect(pages.site.fields.find((f) => f.key === 'links')).toBeTruthy();
  });
  it('ignores a donation link on this site’s own address, which would loop back to /give', () => {
    expect(offSiteLink('https://www.littlecharacters.org/giving-page')).toBeUndefined();
    expect(offSiteLink('https://littlecharacters.org/giving-page')).toBeUndefined();
    expect(offSiteLink('https://www.zeffy.com/en-US/donation-form/x')).toBe('https://www.zeffy.com/en-US/donation-form/x');
    expect(offSiteLink('  ')).toBeUndefined();
  });
  it('the editor refuses a link field pointing at www.littlecharacters.org', () => {
    const fields: Field[] = [{ key: 'giving', label: 'Donation link', type: 'url' }];
    expect(validate(fields, { giving: 'https://www.littlecharacters.org/giving-page' }).ok).toBe(false);
    expect(validate(fields, { giving: '/give' }).ok).toBe(true);
    expect(validate(fields, { giving: 'https://givebutter.com/littlecharacters' }).ok).toBe(true);
  });
});

describe('no links to the site’s own old address', () => {
  it('the starting content never links to www.littlecharacters.org', () => {
    const found = seedEntries().flatMap((e) => (SELF_LINK.test(JSON.stringify(e.data)) ? [`${e.collection}/${e.id}`] : []));
    expect(found).toEqual([]);
  });
  it('nor do the unpublished wording drafts', () => {
    expect(SELF_LINK.test(JSON.stringify(drafts))).toBe(false);
  });
  it('email addresses and other hosts don’t count', () => {
    expect(SELF_LINK.test('hello@littlecharacters.org')).toBe(false);
    expect(SELF_LINK.test('https://littlecharacters.org.example.com/')).toBe(false);
    expect(SELF_LINK.test('see https://www.littlecharacters.org/classes-1')).toBe(true);
  });
});

describe('old site addresses', () => {
  it('sends the tuition-guideline PDFs to the Policies page', () => {
    expect(oldSiteRedirect('/s/Fall-2026-LCTT-Tuition-Guidelines.pdf')).toBe('/policies');
    expect(oldSiteRedirect('/s/Little-Characters-Theater-Troupe-Tuition-Guidelines-2025.pdf')).toBe('/policies');
    expect(oldSiteRedirect('/s/Little-Characters-Theater-Troupe-Tuition-Guidelines-2026.pdf')).toBe('/policies');
    expect(oldSiteRedirect('/s/Little-Characters-Tuition-Guidlines-Spring-2025.pdf')).toBe('/policies');
  });
  it('sends past seasons’ class pages and the other old pages somewhere useful', () => {
    expect(oldSiteRedirect('/spring2024')).toBe('/programs');
    expect(oldSiteRedirect('/athens2024')).toBe('/programs');
    expect(oldSiteRedirect('/winterville2024/')).toBe('/programs');
    expect(oldSiteRedirect('/services')).toBe('/');
    expect(oldSiteRedirect('/store')).toBe('/');
    expect(oldSiteRedirect('/s/Variety-Show-Program.pdf')).toBe('/events');
  });
  it('covers every /s/ PDF the old site linked to on its own address', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const dir = 'content/scraped/pages';
    const pdfs = new Set<string>();
    for (const f of readdirSync(dir)) {
      for (const m of readFileSync(`${dir}/${f}`, 'utf8').matchAll(/\]\((?:https?:\/\/(?:www\.)?littlecharacters\.org)?(\/s\/[^)\s]+\.pdf)\)/gi)) pdfs.add(m[1]);
    }
    expect(pdfs.size).toBeGreaterThan(5);
    expect([...pdfs].filter((p) => !oldSiteRedirect(p))).toEqual([]);
  });
  it('leaves this site’s own pages alone', () => {
    expect(oldSiteRedirect('/policies')).toBeUndefined();
    expect(oldSiteRedirect('/give')).toBeUndefined();
  });
});

describe('“Looks right”', () => {
  const pat: SessionUser = { id: 'u-pat', name: 'Pat Okafor', email: 'pat@example.com', emailVerified: true };
  const other: SessionUser = { id: 'u-other', name: 'Lee Other', email: 'lee@example.com', emailVerified: true };
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-13T16:00:00Z'));
    const db = await getDb();
    await db.insert(schema.user).values([pat, other]);
  });
  afterAll(() => vi.useRealTimers());

  it('records the confirmation and changes nothing else', async () => {
    const h = await ensureHousehold(pat);
    const zara = await createStudent(h.id, { firstName: 'Zara', lastName: 'Okafor', birthdate: '2017-11-02' }, pat.id);
    await updateStudentDetails(h.id, zara.id, { allergies: 'Tree nuts', medicalNotes: '', pickupNotes: 'Grandma Ada', photoConsent: true }, pat.id);
    const db = await getDb();
    const { eq } = await import('drizzle-orm');
    await db.update(schema.student).set({ detailsConfirmedAt: null }).where(eq(schema.student.id, zara.id));
    const before = (await getStudent(h.id, zara.id))!;

    vi.setSystemTime(new Date('2026-10-14T16:00:00Z'));
    expect(await confirmStudentDetails(h.id, zara.id, pat.id)).toBe(true);
    const after = (await getStudent(h.id, zara.id))!;
    expect(after.detailsConfirmedAt?.toISOString()).toBe('2026-10-14T16:00:00.000Z');
    expect(readStudentNotes(after)).toEqual(readStudentNotes(before));
    expect({ ...after, detailsConfirmedAt: null, updatedAt: null }).toEqual({ ...before, detailsConfirmedAt: null, updatedAt: null });
  });

  it('another family can’t confirm someone else’s child', async () => {
    const h = await ensureHousehold(pat);
    const mine = await createStudent(h.id, { firstName: 'Theo', lastName: 'Okafor', birthdate: '2019-04-18' }, pat.id);
    const theirs = await ensureHousehold(other);
    expect(await confirmStudentDetails(theirs.id, mine.id, other.id)).toBe(false);
    expect((await getStudent(h.id, mine.id))!.detailsConfirmedAt).toBeNull();
  });
});
