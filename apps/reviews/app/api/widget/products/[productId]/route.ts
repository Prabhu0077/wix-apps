// Public widget API — published reviews for one product plus the merchant's
// display settings. Called from the storefront widget; no auth.
//
// GET /api/widget/products/[productId]?instanceId=<wix_instance_id>

import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { db, accounts, reviews } from "@/lib/db";
import { readSettings } from "@/lib/settings";

export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
};

const EMPTY = { reviews: [], summary: { total: 0, average: 0, distribution: {} }, display: null };

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const instanceId = req.nextUrl.searchParams.get("instanceId");
  if (!instanceId) {
    return NextResponse.json({ error: "missing_instance_id" }, { status: 400, headers: CORS_HEADERS });
  }

  const account = await db.query.accounts.findFirst({ where: eq(accounts.wixInstanceId, instanceId) });
  if (!account) {
    // Hide quietly on the storefront rather than show an error to shoppers.
    return NextResponse.json(EMPTY, { status: 200, headers: CORS_HEADERS });
  }

  const settings = readSettings(account.settings);

  const published = await db.query.reviews.findMany({
    where: and(eq(reviews.accountId, account.id), eq(reviews.productId, productId), eq(reviews.status, "APPROVED")),
    // Newest written first; publish dates bunch up after bulk approval.
    orderBy: [desc(reviews.createdAt)],
    limit: 50,
    with: { media: true },
  });

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  for (const r of published) {
    sum += r.rating;
    distribution[r.rating] = (distribution[r.rating] ?? 0) + 1;
  }
  const total = published.length;

  return NextResponse.json(
    {
      reviews: published.map((r) => ({
        id: r.id,
        customerName: r.customerName,
        rating: r.rating,
        body: r.body,
        reply: r.reply ?? null,
        verified: r.verified,
        imported: r.source === "IMPORT",
        writtenAt: r.createdAt.toISOString(),
        media: r.media.map((m) => ({ kind: m.kind, url: m.publicUrl, thumbUrl: m.thumbUrl ?? m.publicUrl })),
      })),
      summary: { total, average: total ? Math.round((sum / total) * 10) / 10 : 0, distribution },
      display: {
        theme: settings.widgetTheme,
        starColor: settings.starColor,
        photosFirst: settings.showPhotosFirst,
      },
    },
    { status: 200, headers: CORS_HEADERS },
  );
}
