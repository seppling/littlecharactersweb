-- The staff back office (docs/back-office.md): staff notes about families, the log of staff emails,
-- waitlist offers, and the family's emergency contacts, pickup people, ZIP code and how they heard about us.
-- Contacts aren't encrypted (like parents' phones) but never go in URLs or logs (docs/security.md).
CREATE TABLE "household_note" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"student_id" text,
	"body" text NOT NULL,
	"author_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"session_id" text,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"sent_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_recipient" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"household_id" text,
	"email" text NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist_offer" (
	"id" text PRIMARY KEY NOT NULL,
	"enrollment_id" text NOT NULL,
	"household_id" text NOT NULL,
	"session_id" text NOT NULL,
	"offered_by_user_id" text,
	"offered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"status" text DEFAULT 'offered' NOT NULL,
	"order_id" text
);
--> statement-breakpoint
ALTER TABLE "household" ADD COLUMN "emergency_contacts" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "household" ADD COLUMN "pickup_people" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "household" ADD COLUMN "contacts_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "household" ADD COLUMN "zip" text;--> statement-breakpoint
ALTER TABLE "household" ADD COLUMN "heard_about" text;--> statement-breakpoint
ALTER TABLE "household_note" ADD CONSTRAINT "household_note_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_note" ADD CONSTRAINT "household_note_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_note" ADD CONSTRAINT "household_note_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_sent_by_user_id_user_id_fk" FOREIGN KEY ("sent_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_recipient" ADD CONSTRAINT "message_recipient_message_id_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_recipient" ADD CONSTRAINT "message_recipient_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_offer" ADD CONSTRAINT "waitlist_offer_enrollment_id_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_offer" ADD CONSTRAINT "waitlist_offer_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_offer" ADD CONSTRAINT "waitlist_offer_offered_by_user_id_user_id_fk" FOREIGN KEY ("offered_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_offer" ADD CONSTRAINT "waitlist_offer_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "household_note_household_idx" ON "household_note" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "message_recipient_household_idx" ON "message_recipient" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "message_recipient_message_idx" ON "message_recipient" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "waitlist_offer_enrollment_idx" ON "waitlist_offer" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "waitlist_offer_household_idx" ON "waitlist_offer" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "waitlist_offer_session_idx" ON "waitlist_offer" USING btree ("session_id");