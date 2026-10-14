// Full page of every published review in the store, with paging (Starter plan).
// URL: /widget/all?instanceId=<id>&page=0
// On plans without the feature it renders nothing, so a merchant who
// downgrades just sees the section disappear (reviews stay elsewhere).

import { NextRequest, after } from "next/server";

import { EMBED_HEADERS, NO_STORE_HEADERS, validId } from "@/lib/embed";
import { hasFeature } from "@/lib/features";
import { withProductNames } from "@/lib/store-reviews";
import { displayOf, loadStoreReviews, seen, storeFor, summarize } from "@/lib/widget-data";
import { renderStoreReviewsHtml } from "@/lib/widget-html";

export const runtime = "nodejs";

const EMPTY = "<!doctype html><html><head><meta charset=\"utf-8\"></head><body></body></html>";
const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const instanceId = req.nextUrl.searchParams.get("instanceId");
  if (!validId(instanceId, 100)) return new Response(EMPTY, { headers: EMBED_HEADERS });
  const page = Math.min(500, Math.max(0, parseInt(req.nextUrl.searchParams.get("page") ?? "0", 10) || 0));
  try {
    const account = await storeFor(instanceId);
    if (!account || !hasFeature(account.plan, "allReviewsPage")) {
      return new Response(EMPTY, { headers: EMBED_HEADERS });
    }
    after(seen(account));
    const [{ reviews, hasMore }, summary] = await Promise.all([
      loadStoreReviews(account, PAGE_SIZE, page * PAGE_SIZE),
      summarize(account.id),
    ]);
    const html = renderStoreReviewsHtml({
      kind: "all",
      reviews: await withProductNames(account, reviews),
      summary,
      display: displayOf(account),
      instanceId,
      page,
      hasMore,
    });
    return new Response(html, { headers: EMBED_HEADERS });
  } catch (err) {
    console.error("[widget/all] render failed", err);
    return new Response(EMPTY, { headers: NO_STORE_HEADERS });
  }
}
