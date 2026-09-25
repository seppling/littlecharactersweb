/**
 * Database schema (Postgres, via Drizzle).
 *
 * The class catalog stays in src/data/ for now; enrollments reference catalog
 * sessions by their stable `sessionId`. Everything family-related lives here.
 */
import { relations } from 'drizzle-orm';
import { bigint, boolean, date, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

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
    /** Catalog session id (src/data/programs.ts). */
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
    amountCents: integer('amount_cents').notNull(),
    label: text('label').notNull(),
    /** scheduled → processing → paid; or failed (retried, or waiting for the family); or cancelled by staff. */
    status: text('status', { enum: ['scheduled', 'processing', 'paid', 'failed', 'cancelled'] }).notNull().default('scheduled'),
    attempts: integer('attempts').notNull().default(0),
    /** When a failed charge will be tried again. Null = no more automatic tries. */
    retryOn: date('retry_on'),
    lastError: text('last_error'),
    stripePaymentIntentId: text('stripe_payment_intent_id'),
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

/** Emails captured in development instead of being sent (see /dev/mailbox). */
export const devEmail = pgTable('dev_email', {
  id: id(),
  to: text('to').notNull(),
  subject: text('subject').notNull(),
  text: text('text').notNull(),
  createdAt: created(),
});

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
}));

export const installmentRelations = relations(installment, ({ one }) => ({
  household: one(household, { fields: [installment.householdId], references: [household.id] }),
  order: one(order, { fields: [installment.orderId], references: [order.id] }),
}));
