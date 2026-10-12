CREATE TABLE "content_entry" (
	"collection" text NOT NULL,
	"id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"published" jsonb,
	"draft" jsonb,
	"published_at" timestamp with time zone,
	"published_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	CONSTRAINT "content_entry_collection_id_pk" PRIMARY KEY("collection","id")
);
--> statement-breakpoint
CREATE TABLE "content_revision" (
	"id" integer PRIMARY KEY NOT NULL,
	"revision" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_version" (
	"id" text PRIMARY KEY NOT NULL,
	"collection" text NOT NULL,
	"entry_id" text NOT NULL,
	"data" jsonb,
	"action" text NOT NULL,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" text PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"alt" text,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" integer NOT NULL,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_file" (
	"media_id" text NOT NULL,
	"width" integer NOT NULL,
	"content_type" text NOT NULL,
	"data" "bytea" NOT NULL,
	CONSTRAINT "media_file_media_id_width_pk" PRIMARY KEY("media_id","width")
);
--> statement-breakpoint
ALTER TABLE "media_file" ADD CONSTRAINT "media_file_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_version_entry_idx" ON "content_version" USING btree ("collection","entry_id","created_at");