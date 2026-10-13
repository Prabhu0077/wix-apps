// All Wix webhooks land here.
// Contract: verify → answer 200 fast (Wix waits ~1.25 s) → do work in after().

import { NextRequest, NextResponse, after } from "next/server";
import { and, eq } from "drizzle-orm";

import { db, accounts, reviewRequests } from "@/lib/db";
import { readSettings } from "@/lib/settings";
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

    const delayDays = readSettings(account.settings).emailDelayDays;
    await db.insert(reviewRequests).values({
      accountId: account.id,
      wixOrderId: orderId,
      customerEmail: email,
      productIds: [...new Set(productIds)],
      status: "SCHEDULED",
      scheduledFor: new Date(Date.now() + delayDays * 24 * 60 * 60 * 1000),
    });
    console.log(`[webhook] scheduled review request for order ${orderId} in ${delayDays} days`);
  } catch (err) {
    console.error(`[webhook] failed to process order ${orderId}`, err);
  }
}
