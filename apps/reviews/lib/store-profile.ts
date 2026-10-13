// Server-only: keep the store's name and postal address (from Wix) cached in
// accounts.settings jsonb as storeName / storeAddress / profileFetchedAt.
// Refreshed at install and lazily before sending email, at most once a week,
// so a merchant's edit in Wix shows up within 7 days (sooner on the
// dashboard while the address is missing).

import { eq, sql } from "drizzle-orm";

import { db, accounts } from "@/lib/db";
import { getWixClient } from "@/lib/wix/service";
import { fetchStoreProfile, type StoreProfile } from "@/lib/wix/site";

const REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

type AccountRow = typeof accounts.$inferSelect;

function cached(settings: unknown): (StoreProfile & { fetchedAt: number }) | null {
  const s = (settings ?? {}) as Record<string, unknown>;
  const at = typeof s.profileFetchedAt === "string" ? Date.parse(s.profileFetchedAt) : NaN;
  if (Number.isNaN(at)) return null;
  return {
    storeName: typeof s.storeName === "string" && s.storeName ? s.storeName : null,
    storeAddress: typeof s.storeAddress === "string" && s.storeAddress ? s.storeAddress : null,
    fetchedAt: at,
  };
}

/** Fetch from Wix and merge into settings (jsonb ||, so a concurrent settings save isn't lost). */
export async function refreshStoreProfile(account: Pick<AccountRow, "id" | "wixInstanceId">): Promise<StoreProfile> {
  const profile = await fetchStoreProfile(await getWixClient(account.wixInstanceId));
  const patch = {
    storeName: profile.storeName,
    storeAddress: profile.storeAddress,
    profileFetchedAt: new Date().toISOString(),
  };
  await db
    .update(accounts)
    .set({ settings: sql`${accounts.settings} || ${JSON.stringify(patch)}::jsonb` })
    .where(eq(accounts.id, account.id));
  return profile;
}

/**
 * Cached profile if younger than maxAgeMs; otherwise refresh. Falls back to
 * the cache if Wix fails. The dashboard passes a short maxAge while the
 * address is missing, so a merchant who just added it sees the warning go.
 */
export async function getStoreProfile(account: AccountRow, maxAgeMs: number = REFRESH_MS): Promise<StoreProfile> {
  const hit = cached(account.settings);
  if (hit && Date.now() - hit.fetchedAt < maxAgeMs) return hit;
  try {
    return await refreshStoreProfile(account);
  } catch (err) {
    console.warn(`[store-profile] refresh failed for ${account.wixInstanceId}:`, err instanceof Error ? err.message : err);
    return hit ?? { storeName: null, storeAddress: null };
  }
}
