// Reviews list API — used by the moderation queue
// GET /api/reviews?instance=<signed>&status=PENDING&rating=5&page=0
// Supports: status filter, star-rating filter, pagination (25 per page).

import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db, accounts, reviews } from "@/lib/db";
import { resolveInstanceId } from "@/lib/wix/instance";

export const runtime = "nodejs";

const PAGE_SIZE = 25;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status") ?? "PENDING";
  const page = Math.min(1000, Math.max(0, parseInt(searchParams.get("page") ?? "0", 10) || 0));
  const ratingParam = parseInt(searchParams.get("rating") ?? "", 10);
  const rating = ratingParam >= 1 && ratingParam <= 5 ? ratingParam : null;

  const instanceId = resolveInstanceId(searchParams, req.headers.get("x-wix-instance"));
  if (!instanceId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const account = await db.query.accounts.findFirst({
    where: eq(accounts.wixInstanceId, instanceId),
  });

  if (!account) {
    return NextResponse.json({ error: "account_not_found" }, { status: 404 });
  }

  const validStatuses = ["PENDING", "APPROVED", "REJECTED", "HIDDEN", "ALL"] as const;
  const safeStatus = validStatuses.includes(status as (typeof validStatuses)[number])
    ? status
    : "PENDING";

  const whereClause = and(
    eq(reviews.accountId, account.id),
    safeStatus === "ALL" ? undefined : eq(reviews.status, safeStatus as "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN"),
    rating ? eq(reviews.rating, rating) : undefined,
  );

  // One extra row tells us whether there is another page.
  const rows = await db.query.reviews.findMany({
    where: whereClause,
    orderBy: [desc(reviews.createdAt), desc(reviews.id)],
    limit: PAGE_SIZE + 1,
    offset: page * PAGE_SIZE,
    with: { media: true },
  });

  return NextResponse.json({
    reviews: rows.slice(0, PAGE_SIZE),
    page,
    pageSize: PAGE_SIZE,
    hasMore: rows.length > PAGE_SIZE,
  });
}
