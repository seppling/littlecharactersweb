CREATE TABLE "lead" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"message" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "lead_kind_created_idx" ON "lead" USING btree ("kind","created_at");