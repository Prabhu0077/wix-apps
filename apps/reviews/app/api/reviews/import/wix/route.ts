// One-click import from the native Wix Reviews app (task T8.2).
// POST { instance, cursor? } -> { imported, duplicates, next: string | null }
//
// Imports one page (100 reviews) per call so each call stays well inside the
// function time limit; the dashboard calls again with `next` until it's null.
// Wix's own moderation status is kept (published stays published).
//
// Docs (checked 13 Oct 2026): POST https://www.wixapis.com/reviews/v1/reviews/query
// with namespace "stores"; returnPrivateReviews=true also returns unpublished
// ones (needs the "Manage Reviews" permission; without it we import the
// published ones only). Permission "Read reviews" is required.

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db, accounts } from "@/lib/db";
import { saveImported, type ImportedReview } from "@/lib/import-save";
import { mapWixReview, type WixReviewsQueryResponse as QueryResponse } from "@/lib/wix/reviews-import";
import { resolveInstanceId } from "@/lib/wix/instance";
import { getWixClient } from "@/lib/wix/service";

export const runtime = "nodejs";
export const maxDuration = 60;

const QUERY_URL = "https://www.wixapis.com/reviews/v1/reviews/query";
const BodySchema = z.object({ instance: z.string().optional(), cursor: z.string().max(2000).optional() });

export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const instanceId = resolveInstanceId(req.nextUrl.searchParams, req.headers.get("x-wix-instance"), parsed.data.instance);
  if (!instanceId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const account = await db.query.accounts.findFirst({ where: eq(accounts.wixInstanceId, instanceId) });
  if (!account) return NextResponse.json({ error: "account_not_found" }, { status: 404 });

  const client = await getWixClient(instanceId).catch(() => null);
  if (!client) return NextResponse.json({ error: "not_connected" }, { status: 502 });

  const query = {
    query: {
      filter: { namespace: "stores" },
      cursorPaging: parsed.data.cursor ? { limit: 100, cursor: parsed.data.cursor } : { limit: 100 },
    },
  };
  let res: QueryResponse;
  try {
    res = await client.post<QueryResponse>(`${QUERY_URL}?returnPrivateReviews=true`, query);
  } catch {
    try {
      res = await client.post<QueryResponse>(QUERY_URL, query); // published only
    } catch (err) {
      console.error(`[import/wix] query failed for ${instanceId}`, err);
      return NextResponse.json({ error: "wix_reviews_unavailable" }, { status: 502 });
    }
  }

  const items = (res.reviews ?? []).map(mapWixReview).filter((r): r is ImportedReview => r !== null);
  try {
    const imported = await saveImported(account.id, items);
    return NextResponse.json({
      imported,
      duplicates: items.length - imported,
      next: res.metadata?.cursors?.next ?? null,
    });
  } catch (err) {
    console.error(`[import/wix] save failed for ${instanceId}`, err);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}
