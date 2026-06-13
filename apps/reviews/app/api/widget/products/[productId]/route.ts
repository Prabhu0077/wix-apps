// Storefront widget data endpoint. Called from the embeddable JS that renders
// on the merchant's PDPs. Returns the published reviews + aggregate rating for
// a single product.
//
// Cache aggressively; the widget script reads this on every PDP load.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;
  const instanceId = req.nextUrl.searchParams.get("instanceId");

  if (!instanceId) {
    return NextResponse.json({ error: "missing_instance_id" }, { status: 400 });
  }

  // TODO:
  //   1. Resolve accountId from wixInstanceId.
  //   2. Query published reviews + media for (accountId, productId).
  //   3. Compute aggregate (avg rating, count by star).
  //   4. Cache response (CDN headers).
  return NextResponse.json({
    productId,
    aggregate: { average: 0, count: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } },
    reviews: [],
  }, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
