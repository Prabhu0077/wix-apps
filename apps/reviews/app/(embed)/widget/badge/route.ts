// Star rating badge for the product title area (free on every plan).
// URL: /widget/badge?instanceId=<id>&productId=<id>

import { NextRequest, after } from "next/server";

import { EMBED_HEADERS, NO_STORE_HEADERS, validId } from "@/lib/embed";
import { displayOf, seen, storeFor, summarize } from "@/lib/widget-data";
import { renderBadgeHtml } from "@/lib/widget-html";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const instanceId = req.nextUrl.searchParams.get("instanceId");
  const productId = req.nextUrl.searchParams.get("productId");
  if (!validId(instanceId, 100) || !validId(productId, 200)) {
    return new Response(renderBadgeHtml(null, null), { headers: EMBED_HEADERS });
  }
  try {
    const account = await storeFor(instanceId);
    if (!account) return new Response(renderBadgeHtml(null, null), { headers: EMBED_HEADERS });
    after(seen(account));
    return new Response(renderBadgeHtml(await summarize(account.id, productId), displayOf(account)), { headers: EMBED_HEADERS });
  } catch (err) {
    console.error("[widget/badge] render failed", err);
    return new Response(renderBadgeHtml(null, null), { headers: NO_STORE_HEADERS });
  }
}
