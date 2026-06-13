ALTER TABLE "reviews"."accounts" ADD COLUMN "wix_refresh_token" text;--> statement-breakpoint
ALTER TABLE "reviews"."accounts" ADD COLUMN "wix_access_token" text;--> statement-breakpoint
ALTER TABLE "reviews"."accounts" ADD COLUMN "wix_token_expires_at" timestamp;