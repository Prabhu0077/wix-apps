// Server-only: make sure a store has an account row.
//
// New Wix apps have no install redirect: we learn about an install from the
// "App Installed" webhook. If that webhook is late or missed, the dashboard
// creates the row on first open. Reinstalling within 30 days cancels the
// deletion clock (Wix keeps the same instanceId).

import { eq } from "drizzle-orm";

import { db, accounts } from "@/lib/db";
import { refreshStoreProfile } from "@/lib/store-profile";

import { getWixClient, planFromInstance } from "./service";

type AccountRow = typeof accounts.$inferSelect;

type InstanceInfo = {
  instance?: { isFree?: boolean; billing?: { packageName?: string } };
  // ownerInfo needs the "Read Site Owner Email" permission scope.
  site?: { siteId?: string; ownerEmail?: string; ownerInfo?: { email?: string } };
};

/** Fields we keep from Get App Instance. Exported for tests. */
export function accountFieldsFrom(data: InstanceInfo | null | undefined) {
  return {
    siteId: data?.site?.siteId || "pending",
    ownerEmail: data?.site?.ownerInfo?.email || data?.site?.ownerEmail || "pending@example.com",
    plan: planFromInstance(data?.instance),
  };
}

export async function ensureAccount(wixInstanceId: string): Promise<AccountRow | null> {
  const existing = await db.query.accounts.findFirst({ where: eq(accounts.wixInstanceId, wixInstanceId) });
  if (existing && !existing.uninstalledAt) return existing;

  let info: InstanceInfo | null = null;
  try {
    info = await (await getWixClient(wixInstanceId)).get<InstanceInfo>("https://www.wixapis.com/apps/v1/instance");
  } catch (err) {
    // Not installed (or credentials wrong): don't create a row we can't use.
    console.warn(`[account] Get App Instance failed for ${wixInstanceId}:`, err instanceof Error ? err.message : err);
    return existing ?? null;
  }
  const fields = accountFieldsFrom(info);

  const [row] = await db
    .insert(accounts)
    .values({ wixInstanceId, ...fields })
    .onConflictDoUpdate({
      target: accounts.wixInstanceId,
      set: { ...fields, uninstalledAt: null },
    })
    .returning();

  if (row) {
    await refreshStoreProfile(row).catch((err) =>
      console.warn("[account] store profile not fetched yet:", err instanceof Error ? err.message : err),
    );
  }
  return row ?? null;
}
