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
    expect(mail.at(-1)).toMatchObject({ to: 'littlecharacterstheater@gmail.com', subject: 'Website message from Sam Rivera (classes)' });
    expect(mail.at(-1)?.text).toContain('Is there room in Yes, And?');
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
});
