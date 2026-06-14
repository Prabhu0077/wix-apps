// Dashboard stats API
// GET /api/stats?instanceId=<wix_instance_id>

import { NextRequest, NextResponse } from "next/server";
import { eq, count, and } from "drizzle-orm";
import { db, accounts, reviews, reviewRequests } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const instanceId = req.nextUrl.searchParams.get("instanceId");
  if (!instanceId) {
    return NextResponse.json({ error: "missing_instance_id" }, { status: 400 });
  }

  const account = await db.query.accounts.findFirst({
    where: eq(accounts.wixInstanceId, instanceId),
  });

  if (!account) {
    return NextResponse.json({ error: "account_not_found" }, { status: 404 });
  }

  const [
    [{ total: totalReviews }],
    [{ total: pendingReviews }],
    [{ total: approvedReviews }],
    [{ total: requestsSent }],
  ] = await Promise.all([
    db.select({ total: count() }).from(reviews).where(eq(reviews.accountId, account.id)),
    db.select({ total: count() }).from(reviews).where(and(eq(reviews.accountId, account.id), eq(reviews.status, "PENDING"))),
    db.select({ total: count() }).from(reviews).where(and(eq(reviews.accountId, account.id), eq(reviews.status, "APPROVED"))),
    db.select({ total: count() }).from(reviewRequests).where(eq(reviewRequests.accountId, account.id)),
  ]);

  // Compute average rating from approved reviews
  const approvedList = await db.query.reviews.findMany({
    where: and(eq(reviews.accountId, account.id), eq(reviews.status, "APPROVED")),
    columns: { rating: true },
  });

  const avgRating =
    approvedList.length > 0
      ? Math.round(
          (approvedList.reduce((sum, r) => sum + r.rating, 0) / approvedList.length) * 10
        ) / 10
      : 0;

  return NextResponse.json({
    plan: account.plan,
    totalReviews: Number(totalReviews),
    pendingReviews: Number(pendingReviews),
    approvedReviews: Number(approvedReviews),
    requestsSent: Number(requestsSent),
    avgRating,
  });
}
