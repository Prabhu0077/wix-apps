// "Ask recent customers" (Free): send review requests for orders fulfilled
// in the last 30 days, before the app was installed. Same rules as the
// webhook: one request per order, unsubscribes respected, monthly plan
// limit counted. Orders past the limit are left alone (not recorded as
// skipped), so the merchant can run it again next month.
//
// POST /api/requests/backfill  body: { instance }
// Runs at most once a day per store.

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { readMetaTime, touchMeta } from "@/lib/account-meta";
import { db, accounts } from "@/lib/db";
import { alreadyRequested, scheduleForOrder } from "@/lib/schedule";
import { currentPlan, requestUsage } from "@/lib/usage";
import { resolveInstanceId } from "@/lib/wix/instance";
import { searchFulfilledOrders } from "@/lib/wix/orders";
import { getWixClient } from "@/lib/wix/service";

export const runtime = "nodejs";
export const maxDuration = 60;

const LOOKBACK_DAYS = 30;
const ONCE_PER_MS = 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { instance?: string };
  const instanceId = resolveInstanceId(req.nextUrl.searchParams, req.headers.get("x-wix-instance"), body.instance);
  if (!instanceId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const account = await db.query.accounts.findFirst({ where: eq(accounts.wixInstanceId, instanceId) });
  if (!account || account.uninstalledAt) return NextResponse.json({ error: "account_not_found" }, { status: 404 });

  const last = readMetaTime(account.settings, "backfillAt");
  if (last && Date.now() - last.getTime() < ONCE_PER_MS) {
    return NextResponse.json({ error: "too_soon", nextAt: new Date(last.getTime() + ONCE_PER_MS).toISOString() }, { status: 429 });
  }

  const now = new Date();
  let orders;
  try {
    const client = await getWixClient(account.wixInstanceId);
    orders = await searchFulfilledOrders(client, new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000));
  } catch (err) {
    console.error(`[backfill] order search failed for ${instanceId}:`, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "wix_unavailable" }, { status: 502 });
  }
  await touchMeta(account, "backfillAt", 0);

  const plan = await currentPlan(account);
  const usage = await requestUsage(account.id, plan, now);
  let room = Math.max(0, usage.limit - usage.used);

  const counts = { found: orders.length, scheduled: 0, alreadyAsked: 0, unsubscribed: 0, noEmail: 0, overLimit: 0 };
  for (const order of orders) {
    if (await alreadyRequested(account.id, order.id)) {
      counts.alreadyAsked++;
      continue;
    }
    if (room === 0) {
      counts.overLimit++;
      continue;
    }
    // Sent with the next daily run (09:00 UTC).
    const result = await scheduleForOrder(account, plan, order, now);
    if (result === "scheduled") {
      counts.scheduled++;
      room--;
    } else if (result === "duplicate") counts.alreadyAsked++;
    else if (result === "unsubscribed") counts.unsubscribed++;
    else if (result === "no_email_or_products") counts.noEmail++;
    else counts.overLimit++;
  }

  return NextResponse.json({ ...counts, lookbackDays: LOOKBACK_DAYS, limit: usage.limit });
}
