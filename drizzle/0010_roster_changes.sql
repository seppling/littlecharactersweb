-- Roster changes (docs/back-office.md → Roster changes): why staff added a child without charge,
-- and a staff-written reason on audit entries that need one. Both additive and nullable.
ALTER TABLE "audit_log" ADD COLUMN "detail" text;--> statement-breakpoint
ALTER TABLE "enrollment" ADD COLUMN "no_charge_reason" text;