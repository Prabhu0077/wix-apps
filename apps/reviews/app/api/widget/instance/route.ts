// Which store is this? Called by our storefront custom element
// (public/elements/reviews.js). Wix doesn't expose the instanceId to site
// widgets directly; the element sends the visitor's Wix access token and we
// ask Wix (Get Token Info) which site it belongs to.
//
// GET /api/widget/instance   Authorization: <Wix access token>
//   -> 200 { instanceId } | 401 { error }
// Docs: https://dev.wix.com/docs/build-apps/develop-your-app/develop-a-self-managed-app/supported-extensions/site-extensions/site-widgets-and-plugins/identify-the-app-instance-in-a-self-managed-site-widget

import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { instanceIdFromToken } from "@/lib/wix/oauth";

export const runtime = "nodejs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store",
};

// Visitor tokens repeat for a while; avoid asking Wix on every page view.
// Keyed by a hash so raw tokens are never kept. Per server instance only.
const cache = new Map<string, { instanceId: string; at: number }>();
const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 5000;

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization") ?? "";
  if (!token || token.length > 4096) {
    return NextResponse.json({ error: "missing_token" }, { status: 401, headers: CORS });
  }
  const key = createHash("sha256").update(token).digest("hex");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json({ instanceId: hit.instanceId }, { headers: CORS });
  }

  const instanceId = await instanceIdFromToken(token);
  if (!instanceId) return NextResponse.json({ error: "invalid_token" }, { status: 401, headers: CORS });

  if (cache.size >= MAX_ENTRIES) cache.clear();
  cache.set(key, { instanceId, at: Date.now() });
  return NextResponse.json({ instanceId }, { headers: CORS });
}
