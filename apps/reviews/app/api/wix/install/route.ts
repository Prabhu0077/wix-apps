// OAuth install callback — Wix redirects here after the user approves the
// app installation. We exchange the code for tokens, persist the account,
// then close the installer window.

import { NextRequest, NextResponse } from "next/server";

import { db, accounts } from "@/lib/db";
import { exchangeCodeForToken } from "@/lib/wix/oauth";
import { encryptToken } from "@/lib/auth/crypto";
import { refreshStoreProfile } from "@/lib/store-profile";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const instanceId = req.nextUrl.searchParams.get("instanceId");

  if (!code || !instanceId) {
    return NextResponse.json({ error: "missing_required_params" }, { status: 400 });
  }

  let tokens;
  try {
    tokens = await exchangeCodeForToken(code);
  } catch (err) {
    console.error("[install] token exchange failed", err);
    return NextResponse.json({ error: "token_exchange_failed" }, { status: 502 });
  }

  let siteId = "pending";
  let ownerEmail = "pending@example.com";

  try {
    const instanceRes = await fetch("https://www.wixapis.com/apps/v1/instance", {
      headers: {
        Authorization: tokens.access_token,
      },
    });

    if (instanceRes.ok) {
      const instanceData = await instanceRes.json();
      if (instanceData?.site?.id) {
        siteId = instanceData.site.id;
      }
      if (instanceData?.site?.ownerInfo?.email) {
        ownerEmail = instanceData.site.ownerInfo.email;
      }
    } else {
      const errText = await instanceRes.text().catch(() => "");
      console.warn(`[install] get app instance failed: ${instanceRes.status} ${errText}`);
    }
  } catch (err) {
    console.error("[install] failed to fetch app instance details", err);
  }

  const encryptedAccessToken = encryptToken(tokens.access_token);
  const encryptedRefreshToken = encryptToken(tokens.refresh_token);
  const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  const [account] = await db
    .insert(accounts)
    .values({
      wixInstanceId: instanceId,
      siteId,
      ownerEmail,
      plan: "FREE",
      wixAccessToken: encryptedAccessToken,
      wixRefreshToken: encryptedRefreshToken,
      wixTokenExpiresAt: tokenExpiresAt,
    })
    .onConflictDoUpdate({
      target: accounts.wixInstanceId,
      set: {
        siteId,
        ownerEmail,
        wixAccessToken: encryptedAccessToken,
        wixRefreshToken: encryptedRefreshToken,
        wixTokenExpiresAt: tokenExpiresAt,
        uninstalledAt: null, // reinstall within 30 days cancels deletion
      },
    })
    .returning({ id: accounts.id, wixInstanceId: accounts.wixInstanceId });

  // Store name and postal address for emails (T1.4). Best effort: the send
  // job retries before the first email if this fails.
  if (account) {
    await refreshStoreProfile(account).catch((err) =>
      console.warn("[install] store profile not fetched yet:", err instanceof Error ? err.message : err),
    );
  }

  console.log("[install] tokens successfully stored for instance", instanceId, "expires_in", tokens.expires_in);

  // Wix expects a redirect that closes the installer modal.
  return NextResponse.redirect(
    `https://manage.wix.com/installer/close-window?access_token=${tokens.access_token}`,
  );
}
