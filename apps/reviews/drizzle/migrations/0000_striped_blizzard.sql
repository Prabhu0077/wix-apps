CREATE SCHEMA "reviews";
--> statement-breakpoint
CREATE TYPE "reviews"."media_kind" AS ENUM('PHOTO', 'VIDEO');--> statement-breakpoint
CREATE TYPE "reviews"."plan" AS ENUM('FREE', 'PRO', 'GROWTH');--> statement-breakpoint
CREATE TYPE "reviews"."request_status" AS ENUM('SCHEDULED', 'SENT', 'OPENED', 'COMPLETED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "reviews"."review_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'HIDDEN');--> statement-breakpoint
CREATE TYPE "reviews"."sub_status" AS ENUM('ACTIVE', 'PAST_DUE', 'CANCELLED');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reviews"."accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"wix_instance_id" text NOT NULL,
	"site_id" text NOT NULL,
	"owner_email" text NOT NULL,
	"installed_at" timestamp DEFAULT now() NOT NULL,
	"plan" "reviews"."plan" DEFAULT 'FREE' NOT NULL,
	CONSTRAINT "accounts_wix_instance_id_unique" UNIQUE("wix_instance_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reviews"."review_media" (
	"id" text PRIMARY KEY NOT NULL,
	"review_id" text NOT NULL,
	"kind" "reviews"."media_kind" NOT NULL,
	"r2_key" text NOT NULL,
	"public_url" text NOT NULL,
	"thumb_url" text,
	"width" integer,
	"height" integer,
	"duration_s" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reviews"."review_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"wix_order_id" text NOT NULL,
	"customer_email" text NOT NULL,
	"product_ids" jsonb NOT NULL,
	"status" "reviews"."request_status" NOT NULL,
	"scheduled_for" timestamp NOT NULL,
	"sent_at" timestamp,
	"public_token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "review_requests_public_token_unique" UNIQUE("public_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reviews"."reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"product_id" text NOT NULL,
	"wix_order_id" text,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"rating" integer NOT NULL,
	"body" text NOT NULL,
	"status" "reviews"."review_status" NOT NULL,
	"moderation_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reply" text,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reviews"."subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"wix_order_id" text NOT NULL,
	"plan" "reviews"."plan" NOT NULL,
	"status" "reviews"."sub_status" NOT NULL,
	"renews_at" timestamp,
	CONSTRAINT "subscriptions_wix_order_id_unique" UNIQUE("wix_order_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reviews"."review_media" ADD CONSTRAINT "review_media_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "reviews"."reviews"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reviews"."review_requests" ADD CONSTRAINT "review_requests_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "reviews"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reviews"."reviews" ADD CONSTRAINT "reviews_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "reviews"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reviews"."subscriptions" ADD CONSTRAINT "subscriptions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "reviews"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rr_account_status_idx" ON "reviews"."review_requests" USING btree ("account_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rr_scheduled_idx" ON "reviews"."review_requests" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "r_account_product_idx" ON "reviews"."reviews" USING btree ("account_id","product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "r_status_idx" ON "reviews"."reviews" USING btree ("status");