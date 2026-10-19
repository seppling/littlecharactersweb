-- Small additions to Phase 2 data, made by the coordinator before the units that use them: a no-charge
-- reason and a cancel reason on drop-ins, and when a teacher's note to Hannah was marked read.
ALTER TABLE "class_report" ADD COLUMN "note_read_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "class_report" ADD COLUMN "note_read_by" text;--> statement-breakpoint
ALTER TABLE "drop_in" ADD COLUMN "no_charge_reason" text;--> statement-breakpoint
ALTER TABLE "drop_in" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "class_report" ADD CONSTRAINT "class_report_note_read_by_user_id_fk" FOREIGN KEY ("note_read_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;