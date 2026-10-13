// All Wix webhooks land here.
// Contract: verify → answer 200 fast (Wix waits ~1.25 s) → do work in after().

import { NextRequest, NextResponse, after } from "next/server";
import { and, eq } from "drizzle-orm";

import { db, accounts, reviewRequests } from "@/lib/db";
import { readSettings } from "@/lib/settings";
import { isSuppressed } from "@/lib/suppression";
import { currentPlan, requestUsage } from "@/lib/usage";
import { verifyWixWebhook, type WixEvent } from "@/lib/wix/webhooks";
import { getWixClient } from "@/lib/wix/service";

export const runtime = "nodejs";

type OrderLike = {
  id?: string;
  fulfillmentStatus?: string;
  buyerInfo?: { email?: string };
  billingInfo?: { contactDetails?: { email?: string } };
  shippingInfo?: { deliveries?: { destination?: { contactDetails?: { email?: string } } }[] };
  lineItems?: { productId?: string; catalogReference?: { catalogItemId?: string } }[];
};

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

    const existing = await db.query.reviewRequests.findFirst({
      where: and(eq(reviewRequests.accountId, account.id), eq(reviewRequests.wixOrderId, orderId)),
    });
    if (existing) return; // Wix may deliver the same event more than once.

    // Prefer the order in the event; fetch it only if the event was trimmed.
    let order: OrderLike | undefined = body.order;
    if (!order?.lineItems?.length || !order.buyerInfo?.email) {
      const client = await getWixClient(wixInstanceId);
      order = (await client.get<{ order: OrderLike }>(`https://www.wixapis.com/ecom/v1/orders/${orderId}`))?.order;
    }

    const email =
      order?.buyerInfo?.email ||
      order?.billingInfo?.contactDetails?.email ||
      order?.shippingInfo?.deliveries?.[0]?.destination?.contactDetails?.email;
    const productIds = (order?.lineItems ?? [])
      .map((li) => li.productId || li.catalogReference?.catalogItemId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    if (!email || productIds.length === 0) {
      console.warn(`[webhook] order ${orderId}: missing email or products, skipping`);
      return;
    }

    // The shopper unsubscribed from this store's review emails: don't ask again,
    // and don't count it against the merchant's monthly limit.
    if (await isSuppressed(account.id, email)) {
      console.log(`[webhook] order ${orderId}: customer unsubscribed, not scheduling`);
      return;
    }

    // Monthly limit (PRD R1/R11). Over the limit we still store the order as
    // SKIPPED, so the dashboard can say how many customers were not asked.
    // Two webhooks landing at the same moment can each see "49 used"; the
    // limit can be passed by one or two in that case. Acceptable for a soft
    // monthly cap; it is never under-counted.
    const plan = await currentPlan(account);
    const usage = await requestUsage(account.id, plan);
    const overLimit = usage.used >= usage.limit;

    const delayDays = readSettings(account.settings).emailDelayDays;
    const inserted = await db
      .insert(reviewRequests)
      .values({
        accountId: account.id,
        wixOrderId: orderId,
        customerEmail: email,
        productIds: [...new Set(productIds)],
        status: overLimit ? "SKIPPED" : "SCHEDULED",
        skipReason: overLimit ? "monthly_limit" : null,
        scheduledFor: new Date(Date.now() + delayDays * 24 * 60 * 60 * 1000),
      })
      .onConflictDoNothing({ target: [reviewRequests.accountId, reviewRequests.wixOrderId] })
      .returning({ id: reviewRequests.id });

    if (inserted.length === 0) return; // a duplicate webhook got there first
    console.log(
      overLimit
        ? `[webhook] order ${orderId}: ${plan} limit of ${usage.limit} reached, request skipped`
        : `[webhook] scheduled review request for order ${orderId} in ${delayDays} days`,
    );
  } catch (err) {
    console.error(`[webhook] failed to process order ${orderId}`, err);
  }
}
