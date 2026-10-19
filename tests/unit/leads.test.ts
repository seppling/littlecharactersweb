import { describe, expect, it } from 'vitest';
import { getDb, schema } from '@/server/db';
import { leadInput, listLeads, saveLead } from '@/server/leads';

const parse = (v: Record<string, string>) => leadInput.safeParse(v);

describe('lead forms', () => {
  it('needs a name and a message on the contact form, just an email on signups', () => {
    expect(parse({ kind: 'contact', email: 'sam@example.com' }).success).toBe(false);
    expect(parse({ kind: 'contact', email: 'sam@example.com', name: 'Sam', message: 'Hi!' }).success).toBe(true);
    expect(parse({ kind: 'newsletter', email: 'sam@example.com' }).success).toBe(true);
    expect(parse({ kind: 'newsletter', email: 'not-an-email' }).success).toBe(false);
    expect(parse({ kind: 'mystery', email: 'sam@example.com' }).success).toBe(false);
  });

  it('saves a contact message and emails it to Hannah', async () => {
    const input = parse({ kind: 'contact', email: ' Sam@Example.com ', name: 'Sam Rivera', message: 'Is there room in Yes, And?', topic: 'classes', ages: '8' });
    expect(await saveLead(input.data!)).toBe(true);
    const [lead] = await listLeads();
    expect(lead).toMatchObject({ kind: 'contact', email: 'sam@example.com', name: 'Sam Rivera', details: { topic: 'classes', ages: '8' } });
    const mail = await (await getDb()).select().from(schema.devEmail);
    const toHannah = mail.find((m) => m.to === 'littlecharacterstheater@gmail.com');
    expect(toHannah).toMatchObject({ subject: 'Website message from Sam Rivera (classes)' });
    expect(toHannah?.text).toContain('Is there room in Yes, And?');
  });

  it('ignores a double-click and anything a spam bot fills in', async () => {
    const again = parse({ kind: 'contact', email: 'sam@example.com', name: 'Sam Rivera', message: 'Is there room in Yes, And?' });
    expect(await saveLead(again.data!)).toBe(false);
    const bot = parse({ kind: 'newsletter', email: 'bot@example.com', website: 'http://spam.example' });
    expect(await saveLead(bot.data!)).toBe(false);
    expect((await listLeads()).map((l) => l.email)).toEqual(['sam@example.com']);
  });

  it('keeps signups without emailing anyone', async () => {
    const db = await getDb();
    const before = (await db.select().from(schema.devEmail)).length;
    await saveLead(parse({ kind: 'notify', email: 'ana@example.com', program: 'yes-and' }).data!);
    expect((await db.select().from(schema.devEmail)).length).toBe(before);
    expect((await listLeads())[0]).toMatchObject({ kind: 'notify', details: { program: 'yes-and' } });
  });

  it('asks for the child, class and date when a child will miss a class, and names them for Hannah', async () => {
    expect(parse({ kind: 'contact', email: 'ana@example.com', name: 'Ana', topic: 'absence' }).success).toBe(false);
    expect(parse({ kind: 'contact', email: 'ana@example.com', name: 'Ana', topic: 'absence', child: 'Leo', className: 'Intro to Theater', date: 'next Tuesday' }).success).toBe(false);
    const note = parse({ kind: 'contact', email: 'ana@example.com', name: 'Ana Ruiz', topic: 'absence', child: 'Leo', className: 'Intro to Theater', date: '2026-11-03' });
    expect(note.success).toBe(true);
    expect(await saveLead(note.data!)).toBe(true);
    expect((await listLeads())[0]).toMatchObject({ details: { topic: 'absence', child: 'Leo', className: 'Intro to Theater', date: '2026-11-03' } });
    const mail = await (await getDb()).select().from(schema.devEmail);
    const toHannah = mail.findLast((m) => m.to === 'littlecharacterstheater@gmail.com')!;
    expect(toHannah.text).toContain('About: My child will miss a class');
    expect(toHannah.text).toContain('Child: Leo');
    expect(toHannah.text).toContain('Class: Intro to Theater');
    expect(toHannah.text).toContain('Date: Tuesday, November 3');
  });

  it('sends a signed-in parent a copy of their message, with the reply time when Hannah has set one', async () => {
    const input = parse({ kind: 'contact', email: 'jo@example.com', name: 'Jo Park', message: 'Can Mia switch to Wednesdays?', topic: 'class' });
    await saveLead(input.data!, { sender: { email: 'Jo@example.com', emailVerified: true, name: 'Jo Park' }, replyTime: 'We reply within 2 school days.', phone: '(281) 798-2623' });
    const copy = (await (await getDb()).select().from(schema.devEmail)).findLast((m) => m.to === 'jo@example.com')!;
    expect(copy.subject).toBe('Your message to Little Characters is on its way');
    expect(copy.text).toContain('Hi Jo, thanks for writing. Your message is on its way to us, and we’ll reply by email. We reply within 2 school days.');
    expect(copy.text).toContain('Can Mia switch to Wednesdays?');
    expect(copy.text).toContain('About: Help picking a class');
    expect(copy.text).toContain('call us at (281) 798-2623');
  });

  it('never repeats a stranger’s words to an address that isn’t a signed-in parent’s own, and promises no reply time unless set', async () => {
    const input = parse({ kind: 'contact', email: 'someone@example.com', name: 'Buy pills', message: 'Visit spam.example now' });
    await saveLead(input.data!, { sender: { email: 'other@example.com', emailVerified: true } });
    const note = (await (await getDb()).select().from(schema.devEmail)).findLast((m) => m.to === 'someone@example.com')!;
    expect(note.text).toContain('Your message is on its way to us, and we’ll reply by email.');
    expect(note.text).not.toContain('spam.example');
    expect(note.text).not.toContain('Buy pills');
    expect(note.text).not.toMatch(/within|days/);
  });

  it('sends at most 3 of those notes a day to one address', async () => {
    const db = await getDb();
    const notes = async () => (await db.select().from(schema.devEmail)).filter((m) => m.to === 'many@example.com').length;
    for (let i = 0; i < 5; i++) {
      await saveLead(parse({ kind: 'contact', email: 'many@example.com', name: 'M', message: `Message ${i}` }).data!);
      // Past the double-click window, so every message is kept.
      await db.update(schema.lead).set({ createdAt: new Date(Date.now() - 120_000) });
    }
    expect(await notes()).toBe(3);
    expect((await listLeads()).filter((l) => l.email === 'many@example.com')).toHaveLength(5);
  });
});
