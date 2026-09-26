CREATE TABLE "installment" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"order_id" text NOT NULL,
	"session_id" text NOT NULL,
	"due_date" date NOT NULL,
	"amount_cents" integer NOT NULL,
	"label" text NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"retry_on" date,
	"last_error" text,
	"stripe_payment_intent_id" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "household" ADD COLUMN "stripe_payment_method_id" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "schedule" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "installment" ADD CONSTRAINT "installment_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installment" ADD CONSTRAINT "installment_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "installment_order_due_idx" ON "installment" USING btree ("order_id","due_date");--> statement-breakpoint
CREATE INDEX "installment_status_due_idx" ON "installment" USING btree ("status","due_date");--> statement-breakpoint
CREATE INDEX "installment_household_idx" ON "installment" USING btree ("household_id");