// Public widget API — published reviews for one product plus the merchant's
// display settings, as JSON. The storefront widget itself is server-rendered
// HTML (/widget); this endpoint stays for scripts and future embeds. No auth.
//
// GET /api/widget/products/[productId]?instanceId=<wix_instance_id>

import { NextRequest, NextResponse, after } from "next/server";

import { EMPTY_WIDGET, loadWidgetData } from "@/lib/widget-data";

export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const instanceId = req.nextUrl.searchParams.get("instanceId");
  if (!instanceId) {
    return NextResponse.json({ error: "missing_instance_id" }, { status: 400, headers: CORS_HEADERS });
  }
  const loaded = await loadWidgetData(instanceId, productId);
  // Unknown or uninstalled store: hide quietly rather than show shoppers an error.
  if (!loaded) return NextResponse.json(EMPTY_WIDGET, { status: 200, headers: CORS_HEADERS });
  after(loaded.markSeen);
  return NextResponse.json(loaded.data, { status: 200, headers: CORS_HEADERS });
}
