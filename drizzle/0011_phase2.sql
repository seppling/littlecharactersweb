-- Phase 2 of the staff back office, in one migration (docs/back-office.md → Data for Phase 2):
-- staff added on the site and their classes and substitute dates; attendance and "attendance done";
-- days off; drop-ins; tags; skills and progress notes; show casts and rehearsals; credits and refunds;
-- favorite reports; staff settings. Also: a shared-device flag on sessions, the drop date and reason on
-- enrollments, and the day off a billing adjustment was made for. All additive.
CREATE TABLE "attendance" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"class_date" date NOT NULL,
	"student_id" text NOT NULL,
	"enrollment_id" text,
	"drop_in_id" text,
	"status" text NOT NULL,
	"reason" text,
	"note" text,
	"marked_by" text,
	"marked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"client_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "class_cover" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"class_date" date NOT NULL,
	"staff_id" text NOT NULL,
	"covering_for_staff_id" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_report" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"class_date" date NOT NULL,
	"submitted_by" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_teacher" (
	"session_id" text NOT NULL,
	"staff_id" text NOT NULL,
	"role" text DEFAULT 'lead' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "class_teacher_session_id_staff_id_pk" PRIMARY KEY("session_id","staff_id")
);
--> statement-breakpoint
CREATE TABLE "closure" (
	"id" text PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"session_id" text,
	"reason" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"adjusted_at" timestamp with time zone,
	"adjusted_by" text
);
--> statement-breakpoint
CREATE TABLE "credit" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"reason" text NOT NULL,
	"show_to_family" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_to_installment_id" text,
	"adjustment_id" text,
	"applied_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	"removed_by" text
);
--> statement-breakpoint
CREATE TABLE "drop_in" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"class_date" date NOT NULL,
	"student_id" text NOT NULL,
	"household_id" text NOT NULL,
	"price_cents" integer NOT NULL,
	"order_id" text,
	"status" text DEFAULT 'booked' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "household_tag" (
	"household_id" text NOT NULL,
	"tag_id" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "household_tag_household_id_tag_id_pk" PRIMARY KEY("household_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "progress_note" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"household_id" text NOT NULL,
	"session_id" text,
	"body" text NOT NULL,
	"author_user_id" text,
	"shared_at" timestamp with time zone,
	"message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refund" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"order_id" text,
	"installment_id" text,
	"amount_cents" integer NOT NULL,
	"reason" text NOT NULL,
	"stripe_refund_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refund_stripe_refund_id_unique" UNIQUE("stripe_refund_id")
);
--> statement-breakpoint
CREATE TABLE "report_favorite" (
	"staff_id" text NOT NULL,
	"report_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_favorite_staff_id_report_key_pk" PRIMARY KEY("staff_id","report_key")
);
--> statement-breakpoint
CREATE TABLE "show_cast" (
	"id" text PRIMARY KEY NOT NULL,
	"show_slug" text NOT NULL,
	"student_id" text NOT NULL,
	"role" text NOT NULL,
	"cast_group" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "show_rehearsal" (
	"id" text PRIMARY KEY NOT NULL,
	"show_slug" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"location_id" text,
	"note" text,
	"session_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill" (
	"id" text PRIMARY KEY NOT NULL,
	"program_slug" text NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'teacher' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "staff_setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_skill" (
	"student_id" text NOT NULL,
	"skill_id" text NOT NULL,
	"status" text NOT NULL,
	"marked_by" text,
	"marked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_skill_student_id_skill_id_pk" PRIMARY KEY("student_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "student_tag" (
	"student_id" text NOT NULL,
	"tag_id" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_tag_student_id_tag_id_pk" PRIMARY KEY("student_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "tag" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_adjustment" ADD COLUMN "closure_id" text;--> statement-breakpoint
ALTER TABLE "enrollment" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "enrollment" ADD COLUMN "drop_reason" text;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "shared_device" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_enrollment_id_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_drop_in_id_drop_in_id_fk" FOREIGN KEY ("drop_in_id") REFERENCES "public"."drop_in"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_marked_by_user_id_fk" FOREIGN KEY ("marked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_cover" ADD CONSTRAINT "class_cover_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_cover" ADD CONSTRAINT "class_cover_covering_for_staff_id_staff_id_fk" FOREIGN KEY ("covering_for_staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_cover" ADD CONSTRAINT "class_cover_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_report" ADD CONSTRAINT "class_report_submitted_by_user_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_teacher" ADD CONSTRAINT "class_teacher_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_teacher" ADD CONSTRAINT "class_teacher_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closure" ADD CONSTRAINT "closure_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closure" ADD CONSTRAINT "closure_adjusted_by_user_id_fk" FOREIGN KEY ("adjusted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit" ADD CONSTRAINT "credit_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit" ADD CONSTRAINT "credit_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit" ADD CONSTRAINT "credit_applied_to_installment_id_installment_id_fk" FOREIGN KEY ("applied_to_installment_id") REFERENCES "public"."installment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit" ADD CONSTRAINT "credit_adjustment_id_billing_adjustment_id_fk" FOREIGN KEY ("adjustment_id") REFERENCES "public"."billing_adjustment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit" ADD CONSTRAINT "credit_removed_by_user_id_fk" FOREIGN KEY ("removed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drop_in" ADD CONSTRAINT "drop_in_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drop_in" ADD CONSTRAINT "drop_in_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drop_in" ADD CONSTRAINT "drop_in_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drop_in" ADD CONSTRAINT "drop_in_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_tag" ADD CONSTRAINT "household_tag_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_tag" ADD CONSTRAINT "household_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_tag" ADD CONSTRAINT "household_tag_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_note" ADD CONSTRAINT "progress_note_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_note" ADD CONSTRAINT "progress_note_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_note" ADD CONSTRAINT "progress_note_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_note" ADD CONSTRAINT "progress_note_message_id_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."message"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_installment_id_installment_id_fk" FOREIGN KEY ("installment_id") REFERENCES "public"."installment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_favorite" ADD CONSTRAINT "report_favorite_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "show_cast" ADD CONSTRAINT "show_cast_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "show_cast" ADD CONSTRAINT "show_cast_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "show_rehearsal" ADD CONSTRAINT "show_rehearsal_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill" ADD CONSTRAINT "skill_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_setting" ADD CONSTRAINT "staff_setting_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_skill" ADD CONSTRAINT "student_skill_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_skill" ADD CONSTRAINT "student_skill_skill_id_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_skill" ADD CONSTRAINT "student_skill_marked_by_user_id_fk" FOREIGN KEY ("marked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_tag" ADD CONSTRAINT "student_tag_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_tag" ADD CONSTRAINT "student_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_tag" ADD CONSTRAINT "student_tag_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag" ADD CONSTRAINT "tag_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_session_date_student_idx" ON "attendance" USING btree ("session_id","class_date","student_id");--> statement-breakpoint
CREATE INDEX "attendance_student_idx" ON "attendance" USING btree ("student_id","class_date");--> statement-breakpoint
CREATE INDEX "attendance_date_idx" ON "attendance" USING btree ("class_date");--> statement-breakpoint
CREATE UNIQUE INDEX "class_cover_session_date_staff_idx" ON "class_cover" USING btree ("session_id","class_date","staff_id");--> statement-breakpoint
CREATE INDEX "class_cover_staff_date_idx" ON "class_cover" USING btree ("staff_id","class_date");--> statement-breakpoint
CREATE UNIQUE INDEX "class_report_session_date_idx" ON "class_report" USING btree ("session_id","class_date");--> statement-breakpoint
CREATE INDEX "class_report_date_idx" ON "class_report" USING btree ("class_date");--> statement-breakpoint
CREATE INDEX "class_teacher_staff_idx" ON "class_teacher" USING btree ("staff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "closure_date_session_idx" ON "closure" USING btree ("date",coalesce("session_id", ''));--> statement-breakpoint
CREATE INDEX "credit_household_idx" ON "credit" USING btree ("household_id");--> statement-breakpoint
CREATE UNIQUE INDEX "drop_in_booked_idx" ON "drop_in" USING btree ("session_id","class_date","student_id") WHERE "drop_in"."status" = 'booked';--> statement-breakpoint
CREATE INDEX "drop_in_session_date_idx" ON "drop_in" USING btree ("session_id","class_date");--> statement-breakpoint
CREATE INDEX "drop_in_household_idx" ON "drop_in" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "drop_in_order_idx" ON "drop_in" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "household_tag_tag_idx" ON "household_tag" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "progress_note_student_idx" ON "progress_note" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "progress_note_household_idx" ON "progress_note" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "refund_household_idx" ON "refund" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "refund_order_idx" ON "refund" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "refund_installment_idx" ON "refund" USING btree ("installment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "show_cast_show_student_role_idx" ON "show_cast" USING btree ("show_slug","student_id","role");--> statement-breakpoint
CREATE INDEX "show_cast_student_idx" ON "show_cast" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "show_rehearsal_show_idx" ON "show_rehearsal" USING btree ("show_slug","starts_at");--> statement-breakpoint
CREATE INDEX "skill_program_idx" ON "skill" USING btree ("program_slug","position");--> statement-breakpoint
CREATE INDEX "student_skill_skill_idx" ON "student_skill" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "student_tag_tag_idx" ON "student_tag" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tag_kind_name_idx" ON "tag" USING btree ("kind",lower("name"));--> statement-breakpoint
ALTER TABLE "billing_adjustment" ADD CONSTRAINT "billing_adjustment_closure_id_closure_id_fk" FOREIGN KEY ("closure_id") REFERENCES "public"."closure"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_adjustment_closure_idx" ON "billing_adjustment" USING btree ("closure_id");