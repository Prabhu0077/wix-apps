ALTER TABLE "reviews"."reviews" ADD COLUMN "incentivized" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews"."reviews" ADD COLUMN "source_ref" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "r_account_source_ref_uq" ON "reviews"."reviews" USING btree ("account_id","source_ref");