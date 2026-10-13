// Storefront reviews section, loaded in an iframe on Wix product pages.
// URL: /widget?instanceId=<id>&productId=<id>
// Plain HTML from the server; see lib/widget-html.ts for why (no React).

import { NextRequest, after } from "next/server";

import { loadWidgetData } from "@/lib/widget-data";
import { renderWidgetHtml } from "@/lib/widget-html";

export const runtime = "nodejs";

const HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  // Shoppers see new reviews within about a minute.
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(req: NextRequest) {
  const instanceId = req.nextUrl.searchParams.get("instanceId");
  const productId = req.nextUrl.searchParams.get("productId");
  if (!instanceId || !productId || instanceId.length > 100 || productId.length > 200) {
    return new Response(renderWidgetHtml(null), { status: 200, headers: HEADERS });
  }
  try {
    const loaded = await loadWidgetData(instanceId, productId);
    if (loaded) after(loaded.markSeen);
    // Never show an error on a shop page: unknown store -> empty page.
    return new Response(renderWidgetHtml(loaded?.data ?? null), { status: 200, headers: HEADERS });
  } catch (err) {
    console.error("[widget] render failed", err);
    return new Response(renderWidgetHtml(null), { status: 200, headers: { ...HEADERS, "Cache-Control": "no-store" } });
  }
}
