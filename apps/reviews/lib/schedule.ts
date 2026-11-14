// Server-only: turn one fulfilled order into a review request. Shared by the
// order-fulfilled webhook and "Ask recent customers" (backfill), so both
// follow the same rules: one request per order, unsubscribes respected,
// monthly plan limit counted.

import { and, eq } from "drizzle-orm";

import { db, accounts, reviewRequests } from "@/lib/db";
import type { Plan } from "@/lib/plans";
import { isSuppressed } from "@/lib/suppression";
import { requestUsage } from "@/lib/usage";

export type OrderLike = {
  id?: string;
  status?: string;
  createdDate?: string;
  fulfillmentStatus?: string;
  buyerInfo?: { email?: string };
  billingInfo?: { contactDetails?: { email?: string } };
  shippingInfo?: { deliveries?: { destination?: { contactDetails?: { email?: string } } }[] };
  lineItems?: { productId?: string; catalogReference?: { catalogItemId?: string } }[];
};

export function orderEmail(order: OrderLike | undefined): string | null {
  return (
    order?.buyerInfo?.email ||
    order?.billingInfo?.contactDetails?.email ||
    order?.shippingInfo?.deliveries?.[0]?.destination?.contactDetails?.email ||
    null
  );
}

export function orderProductIds(order: OrderLike | undefined): string[] {
  const ids = (order?.lineItems ?? [])
    .map((li) => li.productId || li.catalogReference?.catalogItemId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  return [...new Set(ids)];
}

export type ScheduleResult = "scheduled" | "over_limit" | "duplicate" | "unsubscribed" | "no_email_or_products";

type AccountRow = typeof accounts.$inferSelect;

export async function alreadyRequested(accountId: string, orderId: string): Promise<boolean> {
  const row = await db.query.reviewRequests.findFirst({
    where: and(eq(reviewRequests.accountId, accountId), eq(reviewRequests.wixOrderId, orderId)),
    columns: { id: true },
  });
  return Boolean(row);
}

/**
 * Schedule (or record as skipped) a request for one order. `sendAt` is when
 * the email should go. Two calls at the same moment can each see "49 used";
 * the monthly limit can then be passed by one or two — accepted for a soft
 * cap, and it is never under-counted.
 */
export async function scheduleForOrder(
  account: AccountRow,
  plan: Plan,
  order: OrderLike & { id: string },
  sendAt: Date,
): Promise<ScheduleResult> {
  const email = orderEmail(order);
  const productIds = orderProductIds(order);
  if (!email || productIds.length === 0) return "no_email_or_products";

  // Unsubscribed shoppers aren't asked and don't count against the limit.
  if (await isSuppressed(account.id, email)) return "unsubscribed";

  const usage = await requestUsage(account.id, plan);
  const overLimit = usage.used >= usage.limit;

  const inserted = await db
    .insert(reviewRequests)
    .values({
      accountId: account.id,
      wixOrderId: order.id,
      customerEmail: email,
      productIds,
      status: overLimit ? "SKIPPED" : "SCHEDULED",
      skipReason: overLimit ? "monthly_limit" : null,
      scheduledFor: sendAt,
    })
    .onConflictDoNothing({ target: [reviewRequests.accountId, reviewRequests.wixOrderId] })
    .returning({ id: reviewRequests.id });

  if (inserted.length === 0) return "duplicate";
  return overLimit ? "over_limit" : "scheduled";
}
