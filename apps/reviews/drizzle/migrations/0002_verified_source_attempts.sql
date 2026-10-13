CREATE TYPE "reviews"."review_source" AS ENUM('REQUEST', 'IMPORT', 'MANUAL');--> statement-breakpoint
ALTER TYPE "reviews"."request_status" ADD VALUE 'FAILED';--> statement-breakpoint
-- settings was added by hand earlier (migrate-settings.mjs), so it may already exist.
ALTER TABLE "reviews"."accounts" ADD COLUMN IF NOT EXISTS "settings" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews"."review_requests" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews"."review_requests" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "reviews"."reviews" ADD COLUMN "verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews"."reviews" ADD COLUMN "source" "reviews"."review_source" DEFAULT 'REQUEST' NOT NULL;