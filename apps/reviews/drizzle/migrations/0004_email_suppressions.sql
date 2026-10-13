CREATE TABLE IF NOT EXISTS "reviews"."email_suppressions" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"email_hash" text NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reviews"."email_suppressions" ADD CONSTRAINT "email_suppressions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "reviews"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "es_account_email_uq" ON "reviews"."email_suppressions" USING btree ("account_id","email_hash");