/**
 * Staff settings that aren't site content (the `staff_setting` table): one
 * JSON value per key, read with a default and written by owners
 * (docs/back-office.md → Staff settings). Each key and its shape is listed in
 * SETTING_KEYS below, so the units that read and write a key agree on it.
 */
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from './db';
import { audit } from './records';

const { staffSetting } = schema;

/** Last season's numbers from Studio Director, typed in once, for the dashboard's comparisons. */
export const baselineSchema = z.object({
  /** "Spring 2026": shown beside each comparison. */
  season: z.string().trim().min(1).max(40),
  /** Children with a class that season, each counted once. */
  children: z.number().int().min(0).max(100_000).optional(),
  /** Of those, how many came back the next season (for "Coming back"). */
  returning: z.number().int().min(0).max(100_000).optional(),
  /** Each class that season and how many were enrolled. */
  classes: z
    .array(z.object({ title: z.string().trim().min(1).max(120), enrolled: z.number().int().min(0).max(1000) }))
    .max(200)
    .default([]),
  /** Money collected each month ("2026-03"), in cents. */
  monthly: z
    .array(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/), collectedCents: z.number().int().min(0) }))
    .max(36)
    .default([]),
});
export type Baseline = z.infer<typeof baselineSchema>;

/** An email's wording from Settings → Emails: the subject and the opening paragraph, with {placeholders} (src/server/email-wording.ts). */
export const wordingSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  /** The opening paragraph (for the progress note: the line at the end). */
  intro: z.string().trim().min(1).max(1000),
});
export type Wording = z.infer<typeof wordingSchema>;

/** A short list Hannah edits in Settings → Reasons: why a child dropped, why a child was absent. */
export const reasonListSchema = z.array(z.string().trim().min(1).max(40)).max(20);

/** The program kinds (src/content/types.ts ProgramKind), for Settings → Attendance. */
export const programKindSchema = z.enum(['class', 'camp', 'workshop', 'lesson', 'inclusive', 'party']);

/**
 * Every key, with its shape. Add a key here before using it.
 * - `reports.baseline`: written by Settings → Last season (settings unit), read by the dashboard (reports unit).
 * - `email.<name>`: Settings → Emails; read by each email's own code (src/server/email-wording.ts).
 * - `reasons.drop`, `reasons.absence`: Settings → Reasons; read by the class page's Remove and the teacher app (src/server/reasons.ts).
 * - `attendance.startDate`, `attendance.kinds`: Settings → Attendance; read by attentionAttendance (src/server/attendance.ts).
 */
export const SETTING_KEYS = {
  'reports.baseline': baselineSchema,
  'email.welcome': wordingSchema,
  'email.payNow': wordingSchema,
  'email.waitlistOffer': wordingSchema,
  'email.dropIn': wordingSchema,
  'email.refund': wordingSchema,
  'email.progressNote': wordingSchema,
  'reasons.drop': reasonListSchema,
  'reasons.absence': reasonListSchema,
  /** "Attendance not taken" only for class dates on or after this date (YYYY-MM-DD). */
  'attendance.startDate': z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** The program kinds that raise "Attendance not taken". */
  'attendance.kinds': z.array(programKindSchema).max(6),
} as const;

export type SettingKey = keyof typeof SETTING_KEYS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTING_KEYS)[K]>;

/** A setting's value, or null when it hasn't been saved (or no longer fits its shape). */
export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K> | null> {
  const db = await getDb();
  const [row] = await db.select({ value: staffSetting.value }).from(staffSetting).where(eq(staffSetting.key, key));
  if (!row) return null;
  const parsed = SETTING_KEYS[key].safeParse(row.value);
  return parsed.success ? (parsed.data as SettingValue<K>) : null;
}

/** Save a setting (checked against its shape) and write the audit log. Callers check that the person is an owner. */
export async function setSetting<K extends SettingKey>(userId: string, key: K, value: SettingValue<K>) {
  const checked = SETTING_KEYS[key].parse(value) as SettingValue<K>;
  const db = await getDb();
  await db
    .insert(staffSetting)
    .values({ key, value: checked, updatedBy: userId })
    .onConflictDoUpdate({ target: staffSetting.key, set: { value: checked, updatedBy: userId, updatedAt: new Date() } });
  await audit(userId, 'admin.setting.update', 'staff_setting', key);
  return checked;
}

/** Remove a setting, so its default applies again. */
export async function clearSetting(userId: string, key: SettingKey) {
  const db = await getDb();
  await db.delete(staffSetting).where(eq(staffSetting.key, key));
  await audit(userId, 'admin.setting.clear', 'staff_setting', key);
}
