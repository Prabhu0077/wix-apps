// Install health check for the dashboard (PRD R10, task T8.4).
// GET /api/health?instance=<signed Wix instance>
//
// Each check says what is wrong in the merchant's words and how to fix it.
// "warn" means "not set up yet / nothing to show"; "error" means something
// is broken and reviews are being lost.

import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, isNotNull } from "drizzle-orm";

import { db, accounts, reviewRequests } from "@/lib/db";
import { readMetaTime } from "@/lib/account-meta";
import { getStoreProfile } from "@/lib/store-profile";
import { getCatalogVersion } from "@/lib/wix/catalog";
import { resolveInstanceId } from "@/lib/wix/instance";
import { getWixClient } from "@/lib/wix/service";

export const runtime = "nodejs";

type Status = "ok" | "warn" | "error";
export type HealthCheck = { key: string; status: Status; title: string; detail: string };

const DAY = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const instanceId = resolveInstanceId(req.nextUrl.searchParams, req.headers.get("x-wix-instance"));
  if (!instanceId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const account = await db.query.accounts.findFirst({ where: eq(accounts.wixInstanceId, instanceId) });
  if (!account) return NextResponse.json({ error: "account_not_found" }, { status: 404 });

  const checks: HealthCheck[] = [];
  const now = Date.now();

  // 1. Connection to Wix and the store catalog.
  // Connected = we can get a token for this site (app installed, keys right).
  const client = await getWixClient(instanceId);
  let connected = false;
  let catalog: Awaited<ReturnType<typeof getCatalogVersion>> = null;
  try {
    await client.get("https://www.wixapis.com/apps/v1/instance");
    connected = true;
    catalog = await getCatalogVersion(client, instanceId);
  } catch {
    connected = false;
  }
  if (!connected) {
    checks.push({
      key: "wix",
      status: "error",
      title: "Not connected to your store",
      detail: "Reinstall the app from the Wix App Market so we can read your orders and products.",
    });
  } else if (catalog === "NONE") {
    checks.push({
      key: "wix",
      status: "error",
      title: "Wix Stores isn't installed",
      detail: "This app collects reviews for Wix Stores products. Add Wix Stores to your site first.",
    });
  } else if (catalog === null) {
    checks.push({
      key: "wix",
      status: "warn",
      title: "Couldn't read your product catalog",
      detail: "Product names may be missing from emails. If this stays, contact support.",
    });
  } else {
    checks.push({ key: "wix", status: "ok", title: "Connected to your store", detail: "We can read your orders and products." });
  }

  // 2. Order events from Wix.
  const lastWebhook = readMetaTime(account.settings, "lastWebhookAt");
  checks.push(
    lastWebhook
      ? {
          key: "orders",
          status: "ok",
          title: "Receiving fulfilled orders",
          detail: `Last order update from Wix: ${lastWebhook.toISOString().slice(0, 10)}.`,
        }
      : {
          key: "orders",
          status: "warn",
          title: "No fulfilled orders yet",
          detail: "Review requests start when you mark an order as fulfilled in Wix.",
        },
  );

  // 3. Emails: last one sent, and recent failures.
  const [lastSent, recentFailure] = await Promise.all([
    db.query.reviewRequests.findFirst({
      where: and(eq(reviewRequests.accountId, account.id), isNotNull(reviewRequests.sentAt)),
      orderBy: [desc(reviewRequests.sentAt)],
      columns: { sentAt: true },
    }),
    db.query.reviewRequests.findFirst({
      where: and(
        eq(reviewRequests.accountId, account.id),
        eq(reviewRequests.status, "FAILED"),
        gte(reviewRequests.createdAt, new Date(now - 30 * DAY)),
      ),
      orderBy: [desc(reviewRequests.createdAt)],
      columns: { lastError: true },
    }),
  ]);
  if (recentFailure) {
    checks.push({
      key: "email",
      status: "error",
      title: "Some review emails couldn't be sent",
      detail: "At least one email failed 5 times in the last 30 days, usually a mistyped customer address. Contact support if it keeps happening.",
    });
  } else if (lastSent?.sentAt) {
    checks.push({
      key: "email",
      status: "ok",
      title: "Review emails are sending",
      detail: `Last email sent: ${lastSent.sentAt.toISOString().slice(0, 10)}.`,
    });
  } else {
    checks.push({
      key: "email",
      status: "warn",
      title: "No review emails sent yet",
      detail: "The first email goes out after the delay you chose in Settings.",
    });
  }

  // 4. Business address (CAN-SPAM; shown in every email footer).
  const profile = await getStoreProfile(account, (account.settings as Record<string, unknown> | null)?.storeAddress ? undefined : 10 * 60 * 1000);
  checks.push(
    profile.storeAddress
      ? { key: "address", status: "ok", title: "Business address set", detail: profile.storeAddress }
      : {
          key: "address",
          status: "warn",
          title: "Business address missing",
          detail: "Add it in your Wix dashboard under Settings › Business Info. Review emails need it by law in the US.",
        },
  );

  // 5. Widget on product pages.
  const widgetSeen = readMetaTime(account.settings, "widgetSeenAt");
  checks.push(
    widgetSeen && now - widgetSeen.getTime() < 14 * DAY
      ? { key: "widget", status: "ok", title: "Reviews show on your product pages", detail: `Last seen on your store: ${widgetSeen.toISOString().slice(0, 10)}.` }
      : {
          key: "widget",
          status: "warn",
          title: widgetSeen ? "Reviews widget not seen lately" : "Reviews widget not seen yet",
          detail: "Open your product page in the Wix Editor and add the Product Reviews widget, then publish your site.",
        },
  );

  return NextResponse.json({ checks });
}
