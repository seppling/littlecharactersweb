/**
 * Staff settings (src/server/settings-store.ts): a key reads as null until
 * saved, saves are checked against the key's shape, a value that no longer
 * fits reads as null, and clearing brings back the default.
 */
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { getDb, schema } from '@/server/db';
import { clearSetting, getSetting, setSetting } from '@/server/settings-store';

const owner = 'u-settings-owner';

beforeAll(async () => {
  const db = await getDb();
  await db.insert(schema.user).values({ id: owner, name: 'Owner', email: 'settings-owner@example.com', emailVerified: true }).onConflictDoNothing();
});

describe('settings store', () => {
  it('reads null until saved, then the saved value with defaults filled in', async () => {
    expect(await getSetting('reports.baseline')).toBeNull();
    await setSetting(owner, 'reports.baseline', { season: 'Spring 2026', children: 120, classes: [], monthly: [{ month: '2026-03', collectedCents: 950000 }] });
    expect(await getSetting('reports.baseline')).toEqual({ season: 'Spring 2026', children: 120, classes: [], monthly: [{ month: '2026-03', collectedCents: 950000 }] });
  });

  it('refuses a value that doesn’t fit the shape', async () => {
    await expect(setSetting(owner, 'reports.baseline', { season: '', classes: [], monthly: [] })).rejects.toThrow();
  });

  it('reads a stored value that no longer fits as null', async () => {
    const db = await getDb();
    await db.update(schema.staffSetting).set({ value: { season: 42 } }).where(eq(schema.staffSetting.key, 'reports.baseline'));
    expect(await getSetting('reports.baseline')).toBeNull();
  });

  it('clears a setting and logs each change', async () => {
    await setSetting(owner, 'reports.baseline', { season: 'Fall 2025', classes: [{ title: 'Intro to Theater', enrolled: 9 }], monthly: [] });
    await clearSetting(owner, 'reports.baseline');
    expect(await getSetting('reports.baseline')).toBeNull();
    const db = await getDb();
    const rows = await db.select({ action: schema.auditLog.action }).from(schema.auditLog).where(eq(schema.auditLog.entityId, 'reports.baseline'));
    expect(rows.map((r) => r.action)).toEqual(expect.arrayContaining(['admin.setting.update', 'admin.setting.clear']));
  });
});
