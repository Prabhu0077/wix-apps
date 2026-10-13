// Small "last seen" timestamps kept in accounts.settings jsonb for the
// health check (task T8.4): when Wix last sent us an order event, and when
// the storefront widget last loaded. Writes are throttled so a busy store
// doesn't turn every widget view into a database write.

import { eq, sql } from "drizzle-orm";

import { db, accounts } from "@/lib/db";

export type MetaKey = "lastWebhookAt" | "widgetSeenAt";

export function readMetaTime(settings: unknown, key: MetaKey): Date | null {
  const v = (settings as Record<string, unknown> | null | undefined)?.[key];
  if (typeof v !== "string") return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t);
}

/** Record "now" for key unless it was recorded within minIntervalMs. Never throws. */
export async function touchMeta(
  account: { id: string; settings: unknown },
  key: MetaKey,
  minIntervalMs: number,
): Promise<void> {
  const last = readMetaTime(account.settings, key);
  if (last && Date.now() - last.getTime() < minIntervalMs) return;
  try {
    await db
      .update(accounts)
      .set({ settings: sql`${accounts.settings} || ${JSON.stringify({ [key]: new Date().toISOString() })}::jsonb` })
      .where(eq(accounts.id, account.id));
  } catch (err) {
    console.warn(`[account-meta] could not record ${key}:`, err instanceof Error ? err.message : err);
  }
}
