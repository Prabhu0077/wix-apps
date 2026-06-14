// One-off migration: add settings jsonb column to reviews.accounts
// Run: node migrate-settings.mjs
// Safe to run multiple times (IF NOT EXISTS).

import { neon } from "@neondatabase/serverless";

const DATABASE_URL =
  "postgresql://neondb_owner:npg_2FRPjmsCa6kI@ep-patient-bird-ah9hhxtl-pooler.c-3.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";

const sql = neon(DATABASE_URL);

async function migrate() {
  console.log("Running migration: add settings column to reviews.accounts...");

  // 1. Add the column (safe if already exists)
  await sql`
    ALTER TABLE reviews.accounts
    ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb
  `;
  console.log("✅ Column added (or already existed)");

  // 2. Migrate any existing __settings__ hacks from wixRefreshToken into the new column
  const rows = await sql`
    SELECT id, wix_refresh_token
    FROM reviews.accounts
    WHERE wix_refresh_token LIKE '__settings__%'
  `;
  console.log(`Found ${rows.length} rows with legacy settings to migrate`);

  for (const row of rows) {
    try {
      const json = row.wix_refresh_token.slice("__settings__".length);
      const parsed = JSON.parse(json);
      await sql`
        UPDATE reviews.accounts
        SET settings = ${JSON.stringify(parsed)}::jsonb,
            wix_refresh_token = NULL
        WHERE id = ${row.id}
      `;
      console.log(`  Migrated account ${row.id}`);
    } catch (e) {
      console.warn(`  Skipped account ${row.id}: ${e.message}`);
    }
  }

  console.log("✅ Migration complete");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
