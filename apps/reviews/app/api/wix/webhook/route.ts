// All Wix webhooks land here.
// Contract: verify → answer 200 fast (Wix waits ~1.25 s) → do work in after().

import { NextRequest, NextResponse, after } from "next/server";
import { and, eq } from "drizzle-orm";

import { db, accounts, reviewRequests } from "@/lib/db";
import { alreadyRequested, scheduleForOrder, type OrderLike } from "@/lib/schedule";
import { touchMeta } from "@/lib/account-meta";
import { readSettings } from "@/lib/settings";
import { currentPlan } from "@/lib/usage";
import { verifyWixWebhook, type WixEvent } from "@/lib/wix/webhooks";
import { getWixClient } from "@/lib/wix/service";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const webhook = await verifyWixWebhook(await req.text());
  if (!webhook) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const { instanceId, event } = webhook;

  // App lifecycle events have a plain eventType and no entityFqdn.
  // Names per Wix's App Instance webhooks; confirm with a real uninstall on
  // the test store (logged below) before launch.
  if (webhook.eventType === "AppRemoved") {
    after(() => markUninstalled(instanceId));
    return NextResponse.json({ ok: true });
  }
  if (webhook.eventType === "AppInstalled") {
    after(() => markReinstalled(instanceId));
    return NextResponse.json({ ok: true });
  }

  const kind = `${event.entityFqdn ?? ""}#${event.slug ?? ""}`;

  switch (kind) {
    // "Order Fulfilled" fires on any fulfilment-status change, including back
    // to not fulfilled — only act when the order is now FULFILLED.
    case "wix.ecom.v1.order#fulfilled":
      after(() => handleOrderFulfilled(instanceId, event));
      break;
    default:
      console.log("[webhook] ignored", webhook.eventType, kind);
  }

  return NextResponse.json({ ok: true });
}

// Not exported — App Router route files may only export HTTP handlers.

// Uninstall: stop all outgoing email at once, drop the Wix tokens (they no
// longer work and shouldn't be kept), and start the 30-day deletion clock.
// Reviews stay until the purge job runs, so a quick reinstall loses nothing.
async function markUninstalled(wixInstanceId: string) {
  try {
    const [account] = await db
      .update(accounts)
      .set({ uninstalledAt: new Date(), wixAccessToken: null, wixRefreshToken: null, wixTokenExpiresAt: null })
      .where(eq(accounts.wixInstanceId, wixInstanceId))
      .returning({ id: accounts.id });
    if (!account) return;
    await db
      .update(reviewRequests)
      .set({ status: "SKIPPED", skipReason: "uninstalled" })
      .where(and(eq(reviewRequests.accountId, account.id), eq(reviewRequests.status, "SCHEDULED")));
    console.log(`[webhook] app removed from instance ${wixInstanceId}; data deleted in 30 days`);
  } catch (err) {
    console.error(`[webhook] failed to mark instance ${wixInstanceId} uninstalled`, err);
  }
}

// Reinstall keeps the same instance ID (Wix), so cancel the deletion clock.
// New tokens arrive through the OAuth install route.
async function markReinstalled(wixInstanceId: string) {
  try {
    await db.update(accounts).set({ uninstalledAt: null }).where(eq(accounts.wixInstanceId, wixInstanceId));
  } catch (err) {
    console.error(`[webhook] failed to clear uninstall for ${wixInstanceId}`, err);
  }
}
async function handleOrderFulfilled(wixInstanceId: string, event: WixEvent) {
  const body = (event.actionEvent?.body ?? {}) as { order?: OrderLike; newFulfillmentStatus?: string };
  const orderId = body.order?.id ?? event.entityId;
  if (!orderId) return;

  const status = body.newFulfillmentStatus ?? body.order?.fulfillmentStatus;
  if (status !== "FULFILLED") {
    console.log(`[webhook] order ${orderId} is ${status ?? "unknown"}, not scheduling`);
    return;
  }

  try {
    const account = await db.query.accounts.findFirst({ where: eq(accounts.wixInstanceId, wixInstanceId) });
    if (!account) {
      console.error(`[webhook] no account for instance ${wixInstanceId}`);
      return;
    }
    if (account.uninstalledAt) return; // late event after uninstall
    await touchMeta(account, "lastWebhookAt", 60 * 60 * 1000); // for the health check

    if (await alreadyRequested(account.id, orderId)) return; // Wix may deliver an event twice.

    // Prefer the order in the event; fetch it only if the event was trimmed.
    let order: OrderLike | undefined = body.order;
    if (!order?.lineItems?.length || !order.buyerInfo?.email) {
      const client = await getWixClient(wixInstanceId);
      order = (await client.get<{ order: OrderLike }>(`https://www.wixapis.com/ecom/v1/orders/${orderId}`))?.order;
    }

    const plan = await currentPlan(account);
    const delayDays = readSettings(account.settings).emailDelayDays;
    const result = await scheduleForOrder(
      account,
      plan,
      { ...(order ?? {}), id: orderId },
      new Date(Date.now() + delayDays * 24 * 60 * 60 * 1000),
    );
    console.log(`[webhook] order ${orderId}: ${result}${result === "scheduled" ? ` (in ${delayDays} days)` : ""}`);
  } catch (err) {
    console.error(`[webhook] failed to process order ${orderId}`, err);
  }
}
