import { eq } from "drizzle-orm";
import { db, accounts } from "@/lib/db";
import { WixClient } from "./client";
import { decryptToken, encryptToken } from "@/lib/auth/crypto";

/**
 * Creates an authenticated WixClient instance for a given Wix Instance ID.
 * Automatically decrypts stored tokens and persists refreshed tokens back to the database.
 */
export async function getWixClient(wixInstanceId: string): Promise<WixClient> {
  const account = await db.query.accounts.findFirst({
    where: eq(accounts.wixInstanceId, wixInstanceId),
  });

  if (!account) {
    throw new Error(`Account not found for Wix Instance ID: ${wixInstanceId}`);
  }

  if (!account.wixAccessToken || !account.wixRefreshToken) {
    throw new Error(`No OAuth tokens stored for Wix Instance ID: ${wixInstanceId}`);
  }

  const accessToken = decryptToken(account.wixAccessToken);
  const refreshToken = decryptToken(account.wixRefreshToken);

  return new WixClient({
    accessToken,
    refreshToken,
    onTokensRefreshed: async (fresh) => {
      const encryptedAccessToken = encryptToken(fresh.accessToken);
      const encryptedRefreshToken = encryptToken(fresh.refreshToken);
      const expiresAt = new Date(Date.now() + fresh.expiresInSec * 1000);

      await db
        .update(accounts)
        .set({
          wixAccessToken: encryptedAccessToken,
          wixRefreshToken: encryptedRefreshToken,
          wixTokenExpiresAt: expiresAt,
        })
        .where(eq(accounts.wixInstanceId, wixInstanceId));

      console.log(`[service] Refreshed and persisted OAuth tokens for Wix Instance ID: ${wixInstanceId}`);
    },
  });
}

/**
 * Determine the current plan for an instance via Wix "Get App Instance".
 * Falls back to the provided plan if the lookup fails.
 * Docs: https://dev.wix.com/docs/rest/app-management/app-instance/get-app-instance
 */
export async function resolvePlan(
  wixInstanceId: string,
  fallback: "FREE" | "PRO" | "GROWTH" = "FREE",
): Promise<"FREE" | "PRO" | "GROWTH"> {
  try {
    const client = await getWixClient(wixInstanceId);
    const data = await client.get<{
      instance?: { isFree?: boolean; billing?: { packageName?: string } };
    }>("https://www.wixapis.com/apps/v1/instance");
    const inst = data?.instance;
    if (!inst || inst.isFree !== false) return "FREE";
    const pkg = (inst.billing?.packageName ?? "").toUpperCase();
    if (pkg.includes("GROWTH")) return "GROWTH";
    if (pkg.includes("STARTER") || pkg.includes("PRO")) return "PRO";
    return "PRO"; // paid, unknown package → lowest paid tier
  } catch {
    return fallback;
  }
}
