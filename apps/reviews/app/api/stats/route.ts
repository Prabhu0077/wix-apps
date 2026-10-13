// Dashboard overview data.
// GET /api/stats?instance=<signed Wix instance>

import { NextRequest, NextResponse } from "next/server";
import { and, count, eq, sql } from "drizzle-orm";

import { db, accounts, reviews, reviewRequests } from "@/lib/db";
import { env } from "@/lib/env";
import { resolveInstanceId } from "@/lib/wix/instance";
import { r2Enabled } from "@/lib/r2";
import { getStoreProfile } from "@/lib/store-profile";
import { currentPlan, requestUsage } from "@/lib/usage";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const instanceId = resolveInstanceId(req.nextUrl.searchParams, req.headers.get("x-wix-instance"));
  if (!instanceId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const account = await db.query.accounts.findFirst({
    where: eq(accounts.wixInstanceId, instanceId),
  });
  if (!account) {
    return NextResponse.json({ error: "account_not_found" }, { status: 404 });
  }

  const [byStatus, byRating, requests] = await Promise.all([
    db
      .select({ status: reviews.status, n: count() })
      .from(reviews)
      .where(eq(reviews.accountId, account.id))
      .groupBy(reviews.status),
    db
      .select({ rating: reviews.rating, n: count() })
      .from(reviews)
      .where(and(eq(reviews.accountId, account.id), eq(reviews.status, "APPROVED")))
      .groupBy(reviews.rating),
    db
      .select({
        // SKIPPED orders were never asked, so they are not "requests".
        total: sql<number>`count(*) filter (where ${reviewRequests.status} <> 'SKIPPED')`,
        sent: sql<number>`count(*) filter (where ${reviewRequests.status} in ('SENT', 'OPENED', 'COMPLETED', 'EXPIRED'))`,
      })
      .from(reviewRequests)
      .where(eq(reviewRequests.accountId, account.id)),
  ]);

  const statusCount = (s: string) => Number(byStatus.find((r) => r.status === s)?.n ?? 0);
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let ratingSum = 0;
  let published = 0;
  for (const row of byRating) {
    const n = Number(row.n);
    distribution[row.rating] = n;
    ratingSum += row.rating * n;
    published += n;
  }

  const plan = await currentPlan(account);
  const usage = await requestUsage(account.id, plan);
  // Wix Business Info (name, postal address). Re-checked every 10 minutes
  // while the address is missing, otherwise weekly.
  const cachedAddress = (account.settings as Record<string, unknown> | null)?.storeAddress;
  const profile = await getStoreProfile(account, cachedAddress ? undefined : 10 * 60 * 1000);

  return NextResponse.json({
    plan,
    totalReviews: byStatus.reduce((sum, r) => sum + Number(r.n), 0),
    pendingReviews: statusCount("PENDING"),
    approvedReviews: published,
    avgRating: published > 0 ? Math.round((ratingSum / published) * 10) / 10 : 0,
    distribution,
    requestsScheduled: Number(requests[0]?.total ?? 0),
    requestsSent: Number(requests[0]?.sent ?? 0),
    storeAddressMissing: !profile.storeAddress,
    photosEnabled: r2Enabled(),
    usage: {
      used: usage.used,
      limit: usage.limit,
      skipped: usage.skipped,
      level: usage.level,
      resetsAt: usage.resetsAt,
    },
    // Wix-hosted upgrade page; paid plans are bought only through Wix Billing.
    upgradeUrl: `https://www.wix.com/apps/upgrade/${env.WIX_APP_ID}?appInstanceId=${instanceId}`,
  });
}
