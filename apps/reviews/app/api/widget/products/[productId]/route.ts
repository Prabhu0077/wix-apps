// Public widget API — returns approved reviews for a product.
// Called by the Wix widget (embedded on product pages) — NO auth required.
// Must be fast: target <200ms P95.
//
// GET /api/widget/products/[productId]?instanceId=<wix_instance_id>

import { NextRequest, NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { db, accounts, reviews, reviewMedia } from "@/lib/db";

export const runtime = "nodejs";

// Allow browsers / Wix iframes to call this
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params;
  const instanceId = req.nextUrl.searchParams.get("instanceId");

  if (!instanceId) {
    return NextResponse.json({ error: "missing_instance_id" }, { status: 400, headers: CORS_HEADERS });
  }

  // Resolve account from instanceId
  const account = await db.query.accounts.findFirst({
    where: eq(accounts.wixInstanceId, instanceId),
  });

  if (!account) {
    // Return empty reviews rather than 404 — widget should gracefully hide
    return NextResponse.json(
      { reviews: [], summary: { total: 0, average: 0, distribution: {} } },
      { status: 200, headers: CORS_HEADERS }
    );
  }

  // Fetch approved reviews for this product
  const approved = await db.query.reviews.findMany({
    where: and(
      eq(reviews.accountId, account.id),
      eq(reviews.productId, productId),
      eq(reviews.status, "APPROVED")
    ),
    orderBy: [desc(reviews.publishedAt)],
    limit: 50,
    with: { media: true },
  });

  // Build rating summary
  const total = approved.length;
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let ratingSum = 0;

  for (const r of approved) {
    ratingSum += r.rating;
    distribution[r.rating] = (distribution[r.rating] ?? 0) + 1;
  }

  const average = total > 0 ? Math.round((ratingSum / total) * 10) / 10 : 0;

  // Shape the response — only expose what the widget needs
  const shaped = approved.map((r) => ({
    id: r.id,
    customerName: r.customerName,
    rating: r.rating,
    body: r.body,
    reply: r.reply ?? null,
    publishedAt: r.publishedAt?.toISOString() ?? r.createdAt.toISOString(),
    media: r.media.map((m) => ({
      kind: m.kind,
      url: m.publicUrl,
      thumbUrl: m.thumbUrl ?? m.publicUrl,
    })),
  }));

  return NextResponse.json(
    { reviews: shaped, summary: { total, average, distribution } },
    { status: 200, headers: CORS_HEADERS }
  );
}
