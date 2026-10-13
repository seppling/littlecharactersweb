-- The month's regular price, before the 15% family discount (src/server/family-discount.ts).
-- Backfill: the site isn't live, so these rows are demo and test data. A monthly order's
-- later months carry the 15% exactly when its checkout lines show the 15% discount, so
-- those get the price back from it (exact for whole-dollar prices); the rest had none.
ALTER TABLE "installment" ADD COLUMN "regular_amount_cents" integer;--> statement-breakpoint
UPDATE "installment" SET "regular_amount_cents" = CASE
	WHEN EXISTS (
		SELECT 1 FROM "order" o, jsonb_array_elements(o."lines") l
		WHERE o."id" = "installment"."order_id" AND l->>'kind' = 'discount' AND l->>'label' = '15% multi-class / multi-student discount'
	) THEN round("base_amount_cents" / 0.85)::integer
	ELSE "base_amount_cents"
END;--> statement-breakpoint
ALTER TABLE "installment" ALTER COLUMN "regular_amount_cents" SET NOT NULL;
