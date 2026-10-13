CREATE TABLE "billing_adjustment" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"order_id" text NOT NULL,
	"kind" text NOT NULL,
	"value" integer NOT NULL,
	"repeat" text NOT NULL,
	"installment_id" text,
	"reason" text NOT NULL,
	"show_to_family" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"removed_by" text
);
--> statement-breakpoint
ALTER TABLE "installment" ADD COLUMN "base_amount_cents" integer;--> statement-breakpoint
UPDATE "installment" SET "base_amount_cents" = "amount_cents";--> statement-breakpoint
ALTER TABLE "installment" ALTER COLUMN "base_amount_cents" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "installment" ADD COLUMN "adjustments" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "installment" ADD COLUMN "pay_now_opened_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "billing_adjustment" ADD CONSTRAINT "billing_adjustment_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_adjustment" ADD CONSTRAINT "billing_adjustment_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_adjustment" ADD CONSTRAINT "billing_adjustment_installment_id_installment_id_fk" FOREIGN KEY ("installment_id") REFERENCES "public"."installment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_adjustment" ADD CONSTRAINT "billing_adjustment_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_adjustment" ADD CONSTRAINT "billing_adjustment_removed_by_user_id_fk" FOREIGN KEY ("removed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_adjustment_order_idx" ON "billing_adjustment" USING btree ("order_id");