CREATE TABLE IF NOT EXISTS "reviews"."review_votes" (
	"id" text PRIMARY KEY NOT NULL,
	"review_id" text NOT NULL,
	"voter_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reviews"."review_requests" ADD COLUMN "reminder_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "reviews"."review_requests" ADD COLUMN "coupon_code" text;--> statement-breakpoint
ALTER TABLE "reviews"."reviews" ADD COLUMN "helpful_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reviews"."review_votes" ADD CONSTRAINT "review_votes_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "reviews"."reviews"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rv_review_voter_uq" ON "reviews"."review_votes" USING btree ("review_id","voter_hash");