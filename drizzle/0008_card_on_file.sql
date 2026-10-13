-- The saved card's brand, last four digits and expiry, shown in the family account (docs/security.md).
-- Copied from Stripe when a card is saved; never the card number.
ALTER TABLE "household" ADD COLUMN "card_brand" text;--> statement-breakpoint
ALTER TABLE "household" ADD COLUMN "card_last4" text;--> statement-breakpoint
ALTER TABLE "household" ADD COLUMN "card_exp_month" integer;--> statement-breakpoint
ALTER TABLE "household" ADD COLUMN "card_exp_year" integer;