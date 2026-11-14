// Server-only: an authenticated WixClient for one site, and the merchant's plan.
//
// Tokens come from Create Access Token (client credentials, see oauth.ts).
// We keep the current one, encrypted, on the account row so a busy store
// doesn't mint a token per request; a site without an account row yet (the
// install webhook) just mints one.

import { eq } from "drizzle-orm";

import { decryptToken, encryptToken } from "@/lib/auth/crypto";
import { db, accounts } from "@/lib/db";
import type { Plan } from "@/lib/plans";

import { WixClient } from "./client";
import { createAppToken } from "./oauth";

// Renew a little early so a token never expires mid-request.
const EARLY_MS = 5 * 60 * 1000;

async function tokenFor(wixInstanceId: string, forceNew: boolean): Promise<string> {
  const account = await db.query.accounts.findFirst({
    where: eq(accounts.wixInstanceId, wixInstanceId),
    columns: { id: true, wixAccessToken: true, wixTokenExpiresAt: true, uninstalledAt: true },
  });
  if (account?.uninstalledAt) throw new Error(`App was removed from instance ${wixInstanceId}`);

  if (!forceNew && account?.wixAccessToken && account.wixTokenExpiresAt) {
    if (account.wixTokenExpiresAt.getTime() - EARLY_MS > Date.now()) {
      try {
        return decryptToken(account.wixAccessToken);
      } catch {
        // Key rotated or row damaged: fall through and mint a new one.
      }
    }
  }

  const fresh = await createAppToken(wixInstanceId);
  if (account) {
    await db
      .update(accounts)
      .set({ wixAccessToken: encryptToken(fresh.accessToken), wixTokenExpiresAt: new Date(fresh.expiresAt) })
      .where(eq(accounts.id, account.id))
      .catch((err) => console.warn("[service] could not cache token:", err instanceof Error ? err.message : err));
  }
  return fresh.accessToken;
}

/** Authenticated client for one site. Never throws here; calls throw if the site can't be reached. */
export async function getWixClient(wixInstanceId: string): Promise<WixClient> {
  return new WixClient((forceNew) => tokenFor(wixInstanceId, forceNew));
}

/**
 * Determine the current plan for an instance via Wix "Get App Instance".
 * `billing.packageName` is the plan name we set in the Wix app dashboard, so
 * name the plans there with FREE / STARTER / PRO / GROWTH in them.
 * Falls back to the provided plan if the lookup fails.
 * Docs: https://dev.wix.com/docs/api-reference/app-management/app-instance/get-app-instance
 */
export async function resolvePlan(wixInstanceId: string, fallback: Plan = "FREE"): Promise<Plan> {
  try {
    const client = await getWixClient(wixInstanceId);
    const data = await client.get<{
      instance?: { isFree?: boolean; billing?: { packageName?: string } };
    }>("https://www.wixapis.com/apps/v1/instance");
    return planFromInstance(data?.instance);
  } catch {
    return fallback;
  }
}

/** Plan from a Get App Instance `instance` object. Exported for tests. */
export function planFromInstance(inst: { isFree?: boolean; billing?: { packageName?: string } } | undefined): Plan {
  if (!inst || inst.isFree !== false) return "FREE";
  const pkg = (inst.billing?.packageName ?? "").toUpperCase();
  if (pkg.includes("GROWTH")) return "GROWTH";
  if (pkg.includes("PRO")) return "PRO";
  if (pkg.includes("STARTER")) return "STARTER";
  return "STARTER"; // paid, unknown package → lowest paid tier
}
