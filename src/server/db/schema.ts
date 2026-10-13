/**
 * Database schema (Postgres, via Drizzle).
 *
 * Families, enrollments and billing, plus the site's editable content (the
 * class catalog, events, page text and photos). Enrollments reference catalog
 * sessions by their stable `sessionId`.
 */
import { relations } from 'drizzle-orm';
import type { AppliedAdjustment } from '../../lib/adjustments';
import { bigint, boolean, customType, date, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

const id = () => text('id').primaryKey().$defaultFn(() => crypto.randomUUID());
const created = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updated = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ───────────── Auth (Better Auth's tables) ─────────────

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  phone: text('phone'),
  createdAt: created(),
  updatedAt: updated(),
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index('session_user_idx').on(t.userId)],
);

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: created(),
  updatedAt: updated(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: created(),
  updatedAt: updated(),
});

/** Sign-in rate limits, kept in the database so they hold across server instances and restarts. */
export const rateLimit = pgTable('rate_limit', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
});

// ───────────── Families ─────────────

export const household = pgTable('household', {
  id: id(),
  name: text('name').notNull(),
  stripeCustomerId: text('stripe_customer_id'),
  /** The card saved at checkout, charged automatically for monthly tuition. */
  stripePaymentMethodId: text('stripe_payment_method_id'),
  /** Where the family came from: signed up on the site, or imported from Studio Director. */
  source: text('source').notNull().default('portal'),
  createdAt: created(),
  updatedAt: updated(),
});

export const householdMember = pgTable(
  'household_member',
  {
    householdId: text('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('guardian'),
    createdAt: created(),
  },
  (t) => [primaryKey({ columns: [t.householdId, t.userId] }), index('household_member_user_idx').on(t.userId)],
);

export const student = pgTable(
  'student',
  {
    id: id(),
    householdId: text('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    birthdate: date('birthdate'),
    /** Encrypted at rest (AES-256-GCM); see src/server/crypto.ts. */
    allergiesEnc: text('allergies_enc'),
    medicalNotesEnc: text('medical_notes_enc'),
    /** Who besides guardians may pick up. */
    pickupNotes: text('pickup_notes'),
    photoConsent: boolean('photo_consent'),
    /** Last time a guardian confirmed these details. We ask again yearly. */
    detailsConfirmedAt: timestamp('details_confirmed_at', { withTimezone: true }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index('student_household_idx').on(t.householdId)],
);

// ───────────── Orders & enrollments ─────────────

/** A future automatic charge, agreed to at checkout (see Installment in src/lib/pricing.ts). */
export type ScheduledCharge = { dueDate: string; amountCents: number; label: string };

export type OrderLine = {
  kind: 'tuition' | 'fee' | 'discount';
  label: string;
  studentId?: string;
  amountCents: number;
};

export const order = pgTable(
  'order',
  {
    id: id(),
    householdId: text('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    /** Catalog session id (a session of a program in the site content). */
    sessionId: text('session_id').notNull(),
    status: text('status', { enum: ['draft', 'pending_payment', 'paid', 'cancelled'] }).notNull().default('draft'),
    plan: text('plan', { enum: ['monthly', 'full', 'trial', 'once', 'waitlist'] }).notNull().default('monthly'),
    studentIds: jsonb('student_ids').$type<string[]>().notNull().default([]),
    lines: jsonb('lines').$type<OrderLine[]>().notNull().default([]),
    subtotalCents: integer('subtotal_cents').notNull().default(0),
    discountCents: integer('discount_cents').notNull().default(0),
    totalCents: integer('total_cents').notNull().default(0),
    /** Monthly plan: the charges still to come, locked in when the family confirms. */
    schedule: jsonb('schedule').$type<ScheduledCharge[]>().notNull().default([]),
    policyVersion: text('policy_version'),
    policyAcceptedAt: timestamp('policy_accepted_at', { withTimezone: true }),
    stripeCheckoutSessionId: text('stripe_checkout_session_id'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdByUserId: text('created_by_user_id').references(() => user.id, { onDelete: 'set null' }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index('order_household_idx').on(t.householdId), uniqueIndex('order_stripe_idx').on(t.stripeCheckoutSessionId)],
);

export const enrollment = pgTable(
  'enrollment',
  {
    id: id(),
    householdId: text('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => student.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').notNull(),
    programSlug: text('program_slug').notNull(),
    status: text('status', { enum: ['active', 'trial', 'waitlist', 'cancelled'] }).notNull(),
    orderId: text('order_id').references(() => order.id, { onDelete: 'set null' }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    index('enrollment_session_idx').on(t.sessionId),
    index('enrollment_household_idx').on(t.householdId),
    uniqueIndex('enrollment_student_session_idx').on(t.studentId, t.sessionId),
  ],
);

/**
 * Monthly tuition charges after the first month. Created when a monthly order is
 * paid; charged on the due date by the daily billing run (src/server/billing.ts).
 */
export const installment = pgTable(
  'installment',
  {
    id: id(),
    householdId: text('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    orderId: text('order_id')
      .notNull()
      .references(() => order.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').notNull(),
    dueDate: date('due_date').notNull(),
    /** What's charged for tuition: the starting amount less any staff adjustments (see src/server/adjustments.ts). */
    amountCents: integer('amount_cents').notNull(),
    /** The amount agreed at checkout, before staff adjustments (built-in discounts already applied). */
    baseAmountCents: integer('base_amount_cents').notNull(),
    /** Staff adjustments taken off this month, as the family sees them. Frozen once paid. */
    adjustments: jsonb('adjustments').$type<AppliedAdjustment[]>().notNull().default([]),
    /** $15 when the month is still unpaid after the 10th (see BILLING.lateFeeCents). Owed on top of amountCents. */
    lateFeeCents: integer('late_fee_cents').notNull().default(0),
    label: text('label').notNull(),
    /** scheduled → processing → paid; or failed (retried, or waiting for the family); or cancelled by staff. */
    status: text('status', { enum: ['scheduled', 'processing', 'paid', 'failed', 'cancelled'] }).notNull().default('scheduled'),
    attempts: integer('attempts').notNull().default(0),
    /** When a failed charge will be tried again. Null = no more automatic tries. */
    retryOn: date('retry_on'),
    lastError: text('last_error'),
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    /** When the family last opened the pay-now form. Its amount is fixed while the form can still be paid. */
    payNowOpenedAt: timestamp('pay_now_opened_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    uniqueIndex('installment_order_due_idx').on(t.orderId, t.dueDate),
    index('installment_status_due_idx').on(t.status, t.dueDate),
    index('installment_household_idx').on(t.householdId),
  ],
);

/**
 * A discount staff give one family's class (a scholarship, pay-what-you-can, a
 * sibling deal, a credit for a missed class). It lowers that order's unpaid
 * monthly payments: the next one only, or every one left. Never deleted;
 * removing it restores the payments that are still unpaid.
 */
export const billingAdjustment = pgTable(
  'billing_adjustment',
  {
    id: id(),
    householdId: text('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    orderId: text('order_id')
      .notNull()
      .references(() => order.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['percent', 'amount'] }).notNull(),
    /** Whole percent (1–100) for 'percent'; cents for 'amount'. */
    value: integer('value').notNull(),
    repeat: text('repeat', { enum: ['once', 'monthly'] }).notNull(),
    /** 'once' only: the payment it takes money off, chosen when it's added. */
    installmentId: text('installment_id').references(() => installment.id, { onDelete: 'set null' }),
    /** Written by staff. Private unless showToFamily. */
    reason: text('reason').notNull(),
    showToFamily: boolean('show_to_family').notNull().default(false),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: created(),
    removedAt: timestamp('removed_at', { withTimezone: true }),
    removedBy: text('removed_by').references(() => user.id, { onDelete: 'set null' }),
  },
  (t) => [index('billing_adjustment_order_idx').on(t.orderId)],
);

/** Contact messages and email signups from the public site's forms (see /api/leads). */
export const lead = pgTable(
  'lead',
  {
    id: id(),
    /** contact | newsletter | notify (a class's "tell me when registration opens") | camps */
    kind: text('kind').notNull(),
    email: text('email').notNull(),
    name: text('name'),
    message: text('message'),
    /** Topic, children's ages, which program, and so on. */
    details: jsonb('details').$type<Record<string, string>>().notNull().default({}),
    createdAt: created(),
  },
  (t) => [index('lead_kind_created_idx').on(t.kind, t.createdAt)],
);

/** Emails captured in development instead of being sent (see /dev/mailbox). */
export const devEmail = pgTable('dev_email', {
  id: id(),
  to: text('to').notNull(),
  subject: text('subject').notNull(),
  text: text('text').notNull(),
  createdAt: created(),
});

// ───────────── Site content (edited at /admin/content) ─────────────

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({ dataType: () => 'bytea' });

/**
 * One class, event, FAQ, team member… or one page's text. The public site
 * shows `published`; `draft` holds edits that haven't been published yet.
 * An entry with no `published` isn't on the site.
 */
export const contentEntry = pgTable(
  'content_entry',
  {
    /** programs | events | faqs | team | testimonials | locations | pages */
    collection: text('collection').notNull(),
    id: text('id').notNull(),
    /** Order within its list. */
    position: integer('position').notNull().default(0),
    published: jsonb('published'),
    draft: jsonb('draft'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    publishedBy: text('published_by'),
    updatedAt: updated(),
    updatedBy: text('updated_by'),
  },
  (t) => [primaryKey({ columns: [t.collection, t.id] })],
);

/** Every version that went live, for the history page and "Restore". `data` is null when the item was deleted. */
export const contentVersion = pgTable(
  'content_version',
  {
    id: id(),
    collection: text('collection').notNull(),
    entryId: text('entry_id').notNull(),
    data: jsonb('data'),
    action: text('action', { enum: ['seed', 'publish', 'restore', 'delete'] }).notNull(),
    userId: text('user_id'),
    createdAt: created(),
  },
  (t) => [index('content_version_entry_idx').on(t.collection, t.entryId, t.createdAt)],
);

/** Goes up by one on every content change, so each running server knows to reload. */
export const contentRevision = pgTable('content_revision', {
  id: integer('id').primaryKey(),
  revision: bigint('revision', { mode: 'number' }).notNull().default(0),
});

/** Photos uploaded in the editor. The resized copies the site serves are in mediaFile. */
export const media = pgTable('media', {
  id: text('id').primaryKey(),
  filename: text('filename').notNull(),
  /** Suggested description, filled into the photo field when it's picked. */
  alt: text('alt'),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  bytes: integer('bytes').notNull(),
  uploadedBy: text('uploaded_by'),
  createdAt: created(),
});

export const mediaFile = pgTable(
  'media_file',
  {
    mediaId: text('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    width: integer('width').notNull(),
    contentType: text('content_type').notNull(),
    data: bytea('data').notNull(),
  },
  (t) => [primaryKey({ columns: [t.mediaId, t.width] })],
);

/** Who did what: payments, admin views, data changes. Kept small on purpose. */
export const auditLog = pgTable(
  'audit_log',
  {
    id: id(),
    userId: text('user_id'),
    action: text('action').notNull(),
    entity: text('entity'),
    entityId: text('entity_id'),
    createdAt: created(),
  },
  (t) => [index('audit_created_idx').on(t.createdAt)],
);

export const householdRelations = relations(household, ({ many }) => ({
  members: many(householdMember),
  students: many(student),
  orders: many(order),
  enrollments: many(enrollment),
}));

export const householdMemberRelations = relations(householdMember, ({ one }) => ({
  household: one(household, { fields: [householdMember.householdId], references: [household.id] }),
  user: one(user, { fields: [householdMember.userId], references: [user.id] }),
}));

export const studentRelations = relations(student, ({ one, many }) => ({
  household: one(household, { fields: [student.householdId], references: [household.id] }),
  enrollments: many(enrollment),
}));

export const enrollmentRelations = relations(enrollment, ({ one }) => ({
  student: one(student, { fields: [enrollment.studentId], references: [student.id] }),
  order: one(order, { fields: [enrollment.orderId], references: [order.id] }),
}));

export const orderRelations = relations(order, ({ one, many }) => ({
  household: one(household, { fields: [order.householdId], references: [household.id] }),
  enrollments: many(enrollment),
  installments: many(installment),
  adjustments: many(billingAdjustment),
}));

export const billingAdjustmentRelations = relations(billingAdjustment, ({ one }) => ({
  order: one(order, { fields: [billingAdjustment.orderId], references: [order.id] }),
}));

export const installmentRelations = relations(installment, ({ one }) => ({
  household: one(household, { fields: [installment.householdId], references: [household.id] }),
  order: one(order, { fields: [installment.orderId], references: [order.id] }),
}));
