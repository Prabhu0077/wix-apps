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
