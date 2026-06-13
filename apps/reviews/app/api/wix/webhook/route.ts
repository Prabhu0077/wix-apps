// Wix webhook fanout. All Wix-triggered events land here.
//
// Contract: respond <1s. Validate signature → enqueue work → return 200.
// Heavy work (sending email, fetching from Wix APIs, transcoding) goes to a
// worker, never inline here.

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, accounts, reviewRequests } from "@/lib/db";
import { getWixClient } from "@/lib/wix/service";
import { after } from "next/server";

import {
  parseWixWebhookPayload,
  verifyWixWebhookSignature,
} from "@/lib/wix/webhooks";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("digest");

  const valid = await verifyWixWebhookSignature(rawBody, signature);
  if (!valid) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload;
  try {
    payload = parseWixWebhookPayload(rawBody);
  } catch (err) {
    console.error("[webhook] invalid payload", err);
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  // Fan out by event slug.
  switch (`${payload.entityFqdn}#${payload.slug}`) {
    case "wix.ecom.v1.order#fulfilled":
      after(async () => {
        await handleOrderFulfilled(payload.instanceId, payload.entityId);
      });
      break;

    case "wix.ecom.v1.order#payment_status_updated":
      console.log("[webhook] payment status updated", payload.entityId);
      break;

    case "wix.app-market.v1.app-instance#installed":
      console.log("[webhook] app instance installed", payload.entityId);
      break;

    case "wix.app-market.v1.app-instance#removed":
      console.log("[webhook] app instance removed", payload.entityId);
      break;

    default:
      console.warn("[webhook] unhandled event", payload.entityFqdn, payload.slug);
      break;
  }

  return NextResponse.json({ ok: true });
}

// Not exported — Next.js App Router rejects non-HTTP named exports from route files.
async function handleOrderFulfilled(wixInstanceId: string, orderId: string) {
  try {
    console.log(`[webhook] processing order fulfilled for instance: ${wixInstanceId}, order: ${orderId}`);

    const account = await db.query.accounts.findFirst({
      where: eq(accounts.wixInstanceId, wixInstanceId),
    });

    if (!account) {
      console.error(`[webhook] Account not found for Wix Instance ID: ${wixInstanceId}`);
      return;
    }

    const existingRequest = await db.query.reviewRequests.findFirst({
      where: and(
        eq(reviewRequests.accountId, account.id),
        eq(reviewRequests.wixOrderId, orderId)
      ),
    });

    if (existingRequest) {
      console.log(`[webhook] ReviewRequest already exists for order ${orderId}, skipping.`);
      return;
    }

    const wixClient = await getWixClient(wixInstanceId);

    console.log(`[webhook] fetching order details for order ${orderId}`);
    const orderRes = await wixClient.get<{ order: any }>(
      `https://www.wixapis.com/ecom/v1/orders/${orderId}`
    );

    const order = orderRes?.order;
    if (!order) {
      console.error(`[webhook] order details not found for order: ${orderId}`);
      return;
    }

    const customerEmail =
      order.buyerInfo?.email ||
      order.billingInfo?.contactDetails?.email ||
      order.shippingInfo?.deliveries?.[0]?.destination?.contactDetails?.email;

    if (!customerEmail) {
      console.error(`[webhook] no customer email found for order ${orderId}`);
      return;
    }

    const lineItems = order.lineItems || [];
    const productIds: string[] = lineItems
      .map((item: any) => item.productId || item.catalogReference?.catalogItemId)
      .filter((id: string | undefined): id is string => typeof id === "string" && id.length > 0);

    if (productIds.length === 0) {
      console.warn(`[webhook] no valid products found in order ${orderId}, skipping.`);
      return;
    }

    const scheduledFor = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    await db.insert(reviewRequests).values({
      accountId: account.id,
      wixOrderId: orderId,
      customerEmail,
      productIds,
      status: "SCHEDULED",
      scheduledFor,
    });

    console.log(
      `[webhook] scheduled review request for order ${orderId} at ${scheduledFor.toISOString()}`
    );
  } catch (err) {
    console.error(`[webhook] failed to process order ${orderId}`, err);
  }
}
