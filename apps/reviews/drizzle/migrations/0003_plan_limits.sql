ALTER TYPE "reviews"."plan" ADD VALUE 'STARTER';--> statement-breakpoint
ALTER TYPE "reviews"."request_status" ADD VALUE 'SKIPPED';--> statement-breakpoint
ALTER TABLE "reviews"."review_requests" ADD COLUMN "skip_reason" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rr_account_order_uq" ON "reviews"."review_requests" USING btree ("account_id","wix_order_id");