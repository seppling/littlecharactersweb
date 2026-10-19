/**
 * Database schema (Postgres, via Drizzle).
 *
 * Families, enrollments and billing, plus the site's editable content (the
 * class catalog, events, page text and photos). Enrollments reference catalog
 * sessions by their stable `sessionId`.
 */
import { relations, sql } from 'drizzle-orm';
import type { AppliedAdjustment } from '../../lib/adjustments';
import type { EmergencyContact, PickupPerson } from '../../lib/contacts';
import { bigint, boolean, customType, date, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, type AnyPgColumn } from 'drizzle-orm/pg-core';

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
    /**
     * Staff ticked "This is a shared device" when signing in: the session ends
     * after 1 hour without use (src/server/staff.ts). Better Auth doesn't know
     * this column; it's set right after sign-in.
     */
    sharedDevice: boolean('shared_device').notNull().default(false),
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
  /**
   * What the family sees of that card ("Visa ending 4242, expires 4/2030"),
   * copied from Stripe when the card is saved. Never the card number.
   */
  cardBrand: text('card_brand'),
  cardLast4: text('card_last4'),
  cardExpMonth: integer('card_exp_month'),
  cardExpYear: integer('card_exp_year'),
  /** Where the family came from: signed up on the site, or imported from Studio Director. */
  source: text('source').notNull().default('portal'),
  /** People besides the parents to call in an emergency (src/lib/contacts.ts). Not encrypted, never in URLs or logs. */
  emergencyContacts: jsonb('emergency_contacts').$type<EmergencyContact[]>().notNull().default([]),
  /** Who may pick the children up, besides the parents. */
  pickupPeople: jsonb('pickup_people').$type<PickupPerson[]>().notNull().default([]),
  /** Last time a parent confirmed the two lists above. */
  contactsConfirmedAt: timestamp('contacts_confirmed_at', { withTimezone: true }),
  zip: text('zip'),
  /** How the family heard about Little Characters, in their words or a choice from the form. */
  heardAbout: text('heard_about'),
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
export type ScheduledCharge = {
  dueDate: string;
  amountCents: number;
  /** Before the 15% family discount. Missing on orders confirmed before it was recorded. */
  regularAmountCents?: number;
  label: string;
};

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
    /**
     * Set when staff added the child without charge (a scholarship, a staff
     * child, a trade): why, in staff's words. No order and no payments, and it
     * never counts toward the 15% family discount. Cleared if the family later
     * signs up and pays for the class.
     */
    noChargeReason: text('no_charge_reason'),
    /** When the enrollment was cancelled (a drop), for the drop reports. Null for older cancellations and for everyone still in the class. */
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    /** Why the child dropped, picked from the reasons in Settings (or typed). Staff only. */
    dropReason: text('drop_reason'),
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
    /**
     * The starting amount, before staff adjustments: the regular price less the
     * 15% family discount when the family has two or more weekly classes (see
     * src/server/family-discount.ts).
     */
    baseAmountCents: integer('base_amount_cents').notNull(),
    /** The month's regular price for this order's children, before any discount. Fixed at checkout, so later price edits never change it. */
    regularAmountCents: integer('regular_amount_cents').notNull(),
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
    /** Set when the calendar made this discount for a day off (closure below), so it can be found and undone with the day off. */
    closureId: text('closure_id').references((): AnyPgColumn => closure.id, { onDelete: 'set null' }),
  },
  (t) => [index('billing_adjustment_order_idx').on(t.orderId), index('billing_adjustment_closure_idx').on(t.closureId)],
);

// ───────────── Back office (staff notes, emails, waitlist offers) ─────────────

/** A staff note about a family, or about one of its children. Staff only; families never see these. */
export const householdNote = pgTable(
  'household_note',
  {
    id: id(),
    householdId: text('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    studentId: text('student_id').references(() => student.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    authorUserId: text('author_user_id').references(() => user.id, { onDelete: 'set null' }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index('household_note_household_idx').on(t.householdId)],
);

/** An email staff sent from the site: to a whole class, or to one family. */
export const message = pgTable('message', {
  id: id(),
  kind: text('kind', { enum: ['class', 'family'] }).notNull(),
  /** The class it went to (kind 'class'). */
  sessionId: text('session_id'),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  sentByUserId: text('sent_by_user_id').references(() => user.id, { onDelete: 'set null' }),
  createdAt: created(),
});

/** One address a message went to, and whether it was sent. The log shown on each family's page. */
export const messageRecipient = pgTable(
  'message_recipient',
  {
    id: id(),
    messageId: text('message_id')
      .notNull()
      .references(() => message.id, { onDelete: 'cascade' }),
    householdId: text('household_id').references(() => household.id, { onDelete: 'set null' }),
    email: text('email').notNull(),
    status: text('status', { enum: ['sent', 'failed'] }).notNull(),
    error: text('error'),
    createdAt: created(),
  },
  (t) => [index('message_recipient_household_idx').on(t.householdId), index('message_recipient_message_idx').on(t.messageId)],
);

/** Staff offering a waitlisted child a place in the class. */
export const waitlistOffer = pgTable(
  'waitlist_offer',
  {
    id: id(),
    /** The waitlisted enrollment. */
    enrollmentId: text('enrollment_id')
      .notNull()
      .references(() => enrollment.id, { onDelete: 'cascade' }),
    householdId: text('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').notNull(),
    offeredByUserId: text('offered_by_user_id').references(() => user.id, { onDelete: 'set null' }),
    offeredAt: timestamp('offered_at', { withTimezone: true }).notNull().defaultNow(),
    /** Null: the offer stays open until staff withdraw it. */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    status: text('status', { enum: ['offered', 'accepted', 'withdrawn', 'expired'] }).notNull().default('offered'),
    /** The order the family placed to accept it. */
    orderId: text('order_id').references(() => order.id, { onDelete: 'set null' }),
  },
  (t) => [index('waitlist_offer_enrollment_idx').on(t.enrollmentId), index('waitlist_offer_household_idx').on(t.householdId), index('waitlist_offer_session_idx').on(t.sessionId)],
);

export type Household = typeof household.$inferSelect;
export type HouseholdNote = typeof householdNote.$inferSelect;
export type Message = typeof message.$inferSelect;
export type MessageRecipient = typeof messageRecipient.$inferSelect;
export type WaitlistOffer = typeof waitlistOffer.$inferSelect;
export type NewHouseholdNote = typeof householdNote.$inferInsert;
export type NewMessage = typeof message.$inferInsert;
export type NewMessageRecipient = typeof messageRecipient.$inferInsert;
export type NewWaitlistOffer = typeof waitlistOffer.$inferInsert;

// ───────────── Phase 2: staff, teachers, attendance, calendar, drop-ins, money, tags, skills, shows ─────────────
// All added in migration 0011_phase2. docs/back-office.md → "Data for Phase 2" says which unit uses each table.
// "By" columns (created_by, marked_by…) are user ids, like the rest of the schema; class assignments use staff ids,
// because a teacher can be assigned before they've ever signed in.

/**
 * People added on the site as staff (Settings → Staff). Owners in ADMIN_EMAILS
 * are owners whatever this table says, and get a row here the first time
 * they're seen so they can be assigned to classes too. Never deleted:
 * deactivating keeps their records.
 */
export const staff = pgTable('staff', {
  id: id(),
  /** Always lowercase. */
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role', { enum: ['owner', 'teacher'] }).notNull().default('teacher'),
  /** False: they can't open staff pages any more. */
  active: boolean('active').notNull().default(true),
  createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
  createdAt: created(),
  updatedAt: updated(),
});

/** Who teaches a class (a catalog session). A class can have several teachers. */
export const classTeacher = pgTable(
  'class_teacher',
  {
    sessionId: text('session_id').notNull(),
    staffId: text('staff_id')
      .notNull()
      .references(() => staff.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['lead', 'assistant'] }).notNull().default('lead'),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: created(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.staffId] }), index('class_teacher_staff_idx').on(t.staffId)],
);

/** A substitute: `staffId` teaches the class on `classDate` only, optionally in place of `coveringForStaffId`. */
export const classCover = pgTable(
  'class_cover',
  {
    id: id(),
    sessionId: text('session_id').notNull(),
    classDate: date('class_date').notNull(),
    staffId: text('staff_id')
      .notNull()
      .references(() => staff.id, { onDelete: 'cascade' }),
    coveringForStaffId: text('covering_for_staff_id').references(() => staff.id, { onDelete: 'set null' }),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex('class_cover_session_date_staff_idx').on(t.sessionId, t.classDate, t.staffId),
    index('class_cover_staff_date_idx').on(t.staffId, t.classDate),
  ],
);

/**
 * One child at one class date (teacher app). Exactly one row per child, class
 * and date: a later tap updates it. `clientId` is the id the phone gave the
 * tap, so a tap sent twice after being offline is stored once.
 */
export const attendance = pgTable(
  'attendance',
  {
    id: id(),
    sessionId: text('session_id').notNull(),
    classDate: date('class_date').notNull(),
    studentId: text('student_id')
      .notNull()
      .references(() => student.id, { onDelete: 'cascade' }),
    /** The child's enrollment in the class, or the drop-in that brought them (one or the other, for a child on the roster). */
    enrollmentId: text('enrollment_id').references(() => enrollment.id, { onDelete: 'set null' }),
    dropInId: text('drop_in_id').references((): AnyPgColumn => dropIn.id, { onDelete: 'set null' }),
    status: text('status', { enum: ['present', 'absent', 'late', 'left_early'] }).notNull(),
    /** An absence reason from Settings (for example "Sick"), when one was picked. */
    reason: text('reason'),
    /** A short note from the teacher. Never care details. */
    note: text('note'),
    markedBy: text('marked_by').references(() => user.id, { onDelete: 'set null' }),
    /** When the teacher tapped, from the phone (it may arrive later). */
    markedAt: timestamp('marked_at', { withTimezone: true }).notNull().defaultNow(),
    clientId: text('client_id')
      .notNull()
      .unique()
      .$defaultFn(() => crypto.randomUUID()),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    uniqueIndex('attendance_session_date_student_idx').on(t.sessionId, t.classDate, t.studentId),
    index('attendance_student_idx').on(t.studentId, t.classDate),
    index('attendance_date_idx').on(t.classDate),
  ],
);

/** "Attendance done" for one class date, with an optional note to Hannah. */
export const classReport = pgTable(
  'class_report',
  {
    id: id(),
    sessionId: text('session_id').notNull(),
    classDate: date('class_date').notNull(),
    submittedBy: text('submitted_by').references(() => user.id, { onDelete: 'set null' }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
    /** The teacher's note to Hannah, if any. */
    note: text('note'),
    /** When an owner marked the note read (it leaves Today then), and who. */
    noteReadAt: timestamp('note_read_at', { withTimezone: true }),
    noteReadBy: text('note_read_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [uniqueIndex('class_report_session_date_idx').on(t.sessionId, t.classDate), index('class_report_date_idx').on(t.classDate)],
);

/**
 * A day off: no class on `date`, for one class (`sessionId`) or for every
 * class that day (null). It blocks attendance that day. The calendar lowers
 * that month's charges for it with billing_adjustment rows (their
 * `closure_id`), and records when it did in `adjustedAt`.
 */
export const closure = pgTable(
  'closure',
  {
    id: id(),
    date: date('date').notNull(),
    sessionId: text('session_id'),
    /** Shown to staff, and to families on the calendar ("Thanksgiving"). */
    reason: text('reason').notNull(),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: created(),
    /** When this day off's charge adjustments were made. Null: not yet (or nothing to adjust). */
    adjustedAt: timestamp('adjusted_at', { withTimezone: true }),
    adjustedBy: text('adjusted_by').references(() => user.id, { onDelete: 'set null' }),
  },
  // One day off per class and date, and one "every class" day off per date.
  (t) => [uniqueIndex('closure_date_session_idx').on(t.date, sql`coalesce(${t.sessionId}, '')`)],
);

/** A family booking one date of a weekly class, paid on its own (the price is a site setting, kept here as booked). */
export const dropIn = pgTable(
  'drop_in',
  {
    id: id(),
    sessionId: text('session_id').notNull(),
    classDate: date('class_date').notNull(),
    studentId: text('student_id')
      .notNull()
      .references(() => student.id, { onDelete: 'cascade' }),
    householdId: text('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    priceCents: integer('price_cents').notNull(),
    /** The payment. */
    orderId: text('order_id').references(() => order.id, { onDelete: 'set null' }),
    /**
     * pending: a checkout or pay link is open (holds no place, ignored
     * everywhere); booked once paid, or at once when staff add it without
     * charge; cancelled by staff.
     */
    status: text('status', { enum: ['pending', 'booked', 'cancelled'] }).notNull().default('booked'),
    /** Staff added it without charge (price 0): why, in their words. */
    noChargeReason: text('no_charge_reason'),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: created(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    /** Why staff cancelled it, in their words. */
    cancelReason: text('cancel_reason'),
  },
  (t) => [
    // A child is booked once per class date; a cancelled booking doesn't block booking again.
    uniqueIndex('drop_in_booked_idx').on(t.sessionId, t.classDate, t.studentId).where(sql`${t.status} = 'booked'`),
    index('drop_in_session_date_idx').on(t.sessionId, t.classDate),
    index('drop_in_household_idx').on(t.householdId),
    index('drop_in_order_idx').on(t.orderId),
  ],
);

/** A staff label for children or families ("Scholarship", "Needs a buddy"), for filtering rosters, search and emails. */
export const tag = pgTable(
  'tag',
  {
    id: id(),
    name: text('name').notNull(),
    kind: text('kind', { enum: ['child', 'family'] }).notNull(),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: created(),
  },
  (t) => [uniqueIndex('tag_kind_name_idx').on(t.kind, sql`lower(${t.name})`)],
);

export const studentTag = pgTable(
  'student_tag',
  {
    studentId: text('student_id')
      .notNull()
      .references(() => student.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tag.id, { onDelete: 'cascade' }),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: created(),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.tagId] }), index('student_tag_tag_idx').on(t.tagId)],
);

export const householdTag = pgTable(
  'household_tag',
  {
    householdId: text('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tag.id, { onDelete: 'cascade' }),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: created(),
  },
  (t) => [primaryKey({ columns: [t.householdId, t.tagId] }), index('household_tag_tag_idx').on(t.tagId)],
);

/** A skill taught in a program (by its slug in the content), in the order teachers see them. Retired skills stay for old records. */
export const skill = pgTable(
  'skill',
  {
    id: id(),
    programSlug: text('program_slug').notNull(),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
    active: boolean('active').notNull().default(true),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: created(),
  },
  (t) => [index('skill_program_idx').on(t.programSlug, t.position)],
);

/** Where a child is with a skill, as a teacher last marked it. */
export const studentSkill = pgTable(
  'student_skill',
  {
    studentId: text('student_id')
      .notNull()
      .references(() => student.id, { onDelete: 'cascade' }),
    skillId: text('skill_id')
      .notNull()
      .references(() => skill.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ['working', 'got_it'] }).notNull(),
    markedBy: text('marked_by').references(() => user.id, { onDelete: 'set null' }),
    markedAt: timestamp('marked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.skillId] }), index('student_skill_skill_idx').on(t.skillId)],
);

/**
 * A progress note about one child, written by staff for the family (the old
 * "report card"). Families see it once it's shared (`sharedAt`); the email
 * that carried it, if any, is `messageId`.
 */
export const progressNote = pgTable(
  'progress_note',
  {
    id: id(),
    studentId: text('student_id')
      .notNull()
      .references(() => student.id, { onDelete: 'cascade' }),
    householdId: text('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    /** The class it's about, if one. */
    sessionId: text('session_id'),
    body: text('body').notNull(),
    authorUserId: text('author_user_id').references(() => user.id, { onDelete: 'set null' }),
    sharedAt: timestamp('shared_at', { withTimezone: true }),
    messageId: text('message_id').references(() => message.id, { onDelete: 'set null' }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index('progress_note_student_idx').on(t.studentId), index('progress_note_household_idx').on(t.householdId)],
);

/** A child's part in a show (the event's slug in the content). A child can have more than one role. */
export const showCast = pgTable(
  'show_cast',
  {
    id: id(),
    showSlug: text('show_slug').notNull(),
    studentId: text('student_id')
      .notNull()
      .references(() => student.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    /** A group within the cast ("Ensemble", "Act 2"), if any. */
    castGroup: text('cast_group'),
    /** Order on the cast list and in the program. */
    position: integer('position').notNull().default(0),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: created(),
  },
  (t) => [uniqueIndex('show_cast_show_student_role_idx').on(t.showSlug, t.studentId, t.role), index('show_cast_student_idx').on(t.studentId)],
);

/** A rehearsal for a show. Times are entered and shown in Athens time; stored as instants. */
export const showRehearsal = pgTable(
  'show_rehearsal',
  {
    id: id(),
    showSlug: text('show_slug').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    /** A location's id in the content. */
    locationId: text('location_id'),
    note: text('note'),
    /** The classes (catalog session ids) that rehearse; empty means the whole cast. */
    sessionIds: jsonb('session_ids').$type<string[]>().notNull().default([]),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: created(),
  },
  (t) => [index('show_rehearsal_show_idx').on(t.showSlug, t.startsAt)],
);

/**
 * Money a family is owed, taken off their next charge. Applied once:
 * `appliedToInstallmentId` and `appliedAt` say where it went (the refunds
 * unit decides how, for example as a billing_adjustment, `adjustmentId`).
 */
export const credit = pgTable(
  'credit',
  {
    id: id(),
    householdId: text('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    amountCents: integer('amount_cents').notNull(),
    /** Written by staff. Private unless showToFamily. */
    reason: text('reason').notNull(),
    showToFamily: boolean('show_to_family').notNull().default(false),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: created(),
    appliedToInstallmentId: text('applied_to_installment_id').references(() => installment.id, { onDelete: 'set null' }),
    adjustmentId: text('adjustment_id').references(() => billingAdjustment.id, { onDelete: 'set null' }),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
    /** Taken back by staff before it was used. */
    removedAt: timestamp('removed_at', { withTimezone: true }),
    removedBy: text('removed_by').references(() => user.id, { onDelete: 'set null' }),
  },
  (t) => [index('credit_household_idx').on(t.householdId)],
);

/**
 * Money given back through Stripe, for a sign-up payment (`orderId`) or a
 * monthly charge (`installmentId`). The row is written `pending` before
 * Stripe is called (its id is the idempotency key), then marked.
 */
export const refund = pgTable(
  'refund',
  {
    id: id(),
    householdId: text('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    orderId: text('order_id').references(() => order.id, { onDelete: 'set null' }),
    installmentId: text('installment_id').references(() => installment.id, { onDelete: 'set null' }),
    amountCents: integer('amount_cents').notNull(),
    reason: text('reason').notNull(),
    stripeRefundId: text('stripe_refund_id').unique(),
    status: text('status', { enum: ['pending', 'succeeded', 'failed'] }).notNull().default('pending'),
    /** Stripe's reason, when it failed. */
    error: text('error'),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index('refund_household_idx').on(t.householdId), index('refund_order_idx').on(t.orderId), index('refund_installment_idx').on(t.installmentId)],
);

/** A report a staff member starred, by its key in the reports library. */
export const reportFavorite = pgTable(
  'report_favorite',
  {
    staffId: text('staff_id')
      .notNull()
      .references(() => staff.id, { onDelete: 'cascade' }),
    reportKey: text('report_key').notNull(),
    createdAt: created(),
  },
  (t) => [primaryKey({ columns: [t.staffId, t.reportKey] })],
);

/**
 * Staff settings that aren't site content: email wording, the lists of drop
 * and absence reasons (Settings unit). One JSON value per key; the unit that
 * owns a key documents its shape.
 */
export const staffSetting = pgTable('staff_setting', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
  updatedAt: updated(),
});

export type Staff = typeof staff.$inferSelect;
export type StaffRole = Staff['role'];
export type ClassTeacher = typeof classTeacher.$inferSelect;
export type ClassCover = typeof classCover.$inferSelect;
export type Attendance = typeof attendance.$inferSelect;
export type AttendanceStatus = Attendance['status'];
export type ClassReport = typeof classReport.$inferSelect;
export type Closure = typeof closure.$inferSelect;
export type DropIn = typeof dropIn.$inferSelect;
export type Tag = typeof tag.$inferSelect;
export type StudentTag = typeof studentTag.$inferSelect;
export type HouseholdTag = typeof householdTag.$inferSelect;
export type Skill = typeof skill.$inferSelect;
export type StudentSkill = typeof studentSkill.$inferSelect;
export type ProgressNote = typeof progressNote.$inferSelect;
export type ShowCast = typeof showCast.$inferSelect;
export type ShowRehearsal = typeof showRehearsal.$inferSelect;
export type Credit = typeof credit.$inferSelect;
export type Refund = typeof refund.$inferSelect;
export type ReportFavorite = typeof reportFavorite.$inferSelect;
export type StaffSetting = typeof staffSetting.$inferSelect;
export type NewStaff = typeof staff.$inferInsert;
export type NewClassTeacher = typeof classTeacher.$inferInsert;
export type NewClassCover = typeof classCover.$inferInsert;
export type NewAttendance = typeof attendance.$inferInsert;
export type NewClassReport = typeof classReport.$inferInsert;
export type NewClosure = typeof closure.$inferInsert;
export type NewDropIn = typeof dropIn.$inferInsert;
export type NewTag = typeof tag.$inferInsert;
export type NewSkill = typeof skill.$inferInsert;
export type NewStudentSkill = typeof studentSkill.$inferInsert;
export type NewProgressNote = typeof progressNote.$inferInsert;
export type NewShowCast = typeof showCast.$inferInsert;
export type NewShowRehearsal = typeof showRehearsal.$inferInsert;
export type NewCredit = typeof credit.$inferInsert;
export type NewRefund = typeof refund.$inferInsert;

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
    /** A staff-written reason, where the action needs one (adding a child without charge). Never children's care details. */
    detail: text('detail'),
    createdAt: created(),
  },
  (t) => [index('audit_created_idx').on(t.createdAt)],
);

export const householdRelations = relations(household, ({ many }) => ({
  members: many(householdMember),
  students: many(student),
  orders: many(order),
  enrollments: many(enrollment),
  notes: many(householdNote),
}));

export const householdNoteRelations = relations(householdNote, ({ one }) => ({
  household: one(household, { fields: [householdNote.householdId], references: [household.id] }),
  student: one(student, { fields: [householdNote.studentId], references: [student.id] }),
}));

export const messageRelations = relations(message, ({ many }) => ({
  recipients: many(messageRecipient),
}));

export const messageRecipientRelations = relations(messageRecipient, ({ one }) => ({
  message: one(message, { fields: [messageRecipient.messageId], references: [message.id] }),
  household: one(household, { fields: [messageRecipient.householdId], references: [household.id] }),
}));

export const waitlistOfferRelations = relations(waitlistOffer, ({ one }) => ({
  enrollment: one(enrollment, { fields: [waitlistOffer.enrollmentId], references: [enrollment.id] }),
  household: one(household, { fields: [waitlistOffer.householdId], references: [household.id] }),
  order: one(order, { fields: [waitlistOffer.orderId], references: [order.id] }),
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
