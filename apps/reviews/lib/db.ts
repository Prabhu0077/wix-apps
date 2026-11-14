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

function makeDb() {
  return drizzle(neon(env.DATABASE_URL), { schema });
}
export type DB = ReturnType<typeof makeDb>;

// Created on first use, so importing this module (e.g. during `next build`)
// needs no DATABASE_URL.
let instance: DB | null = null;
export const db: DB = new Proxy({} as DB, {
  get(_t, key) {
    instance ??= makeDb();
    const value = Reflect.get(instance, key, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

// Re-export schema for convenience: `import { db, accounts } from "@/lib/db"`
export * from "../drizzle/schema";
