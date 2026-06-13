// Drizzle ORM client wired to Neon's HTTP driver.
// Use the exported `db` everywhere — never instantiate again.
//
// Why HTTP driver: faster cold starts on Vercel (no socket setup), works in
// edge runtimes. For long-lived workers (cron, FFmpeg), switch to the pooled
// driver — but that's a separate file when we get there.

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

import { env } from "./env";
import * as schema from "../drizzle/schema";

const sql = neon(env.DATABASE_URL);

export const db = drizzle(sql, { schema });
export type DB = typeof db;

// Re-export schema for convenience: `import { db, accounts } from "@/lib/db"`
export * from "../drizzle/schema";
