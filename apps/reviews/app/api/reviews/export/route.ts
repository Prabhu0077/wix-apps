// Export every review for the store as CSV — on every plan, including Free
// (PRD v2 R9, goal G2: reviews are never held hostage).
// GET /api/reviews/export?instance=<signed Wix instance>
//
// Streams in pages of 500 so a store with many reviews doesn't hit the
// function's memory or time limits. Includes hidden and unpublished reviews
// and the reviewer's email: this is the merchant's own data.

import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, gt } from "drizzle-orm";

import { db, accounts, reviews } from "@/lib/db";
import { CSV_BOM, csvRow } from "@/lib/csv";
import { resolveInstanceId } from "@/lib/wix/instance";

export const runtime = "nodejs";
export const maxDuration = 60;

const PAGE = 500;

const HEADER = [
  "review_id",
  "product_id",
  "rating",
  "review",
  "reviewer_name",
  "reviewer_email",
  "status",
  "verified_buyer",
  "source",
  "order_id",
  "store_reply",
  "photo_urls",
  "written_at",
  "published_at",
];

export async function GET(req: NextRequest) {
  const instanceId = resolveInstanceId(req.nextUrl.searchParams, req.headers.get("x-wix-instance"));
  if (!instanceId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const account = await db.query.accounts.findFirst({ where: eq(accounts.wixInstanceId, instanceId) });
  if (!account) return NextResponse.json({ error: "account_not_found" }, { status: 404 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(CSV_BOM + csvRow(HEADER)));
        // Keyset paging on id (cuid2 ids are unique and sortable as text).
        let after = "";
        for (;;) {
          const rows = await db.query.reviews.findMany({
            where: after ? and(eq(reviews.accountId, account.id), gt(reviews.id, after)) : eq(reviews.accountId, account.id),
            orderBy: [asc(reviews.id)],
            limit: PAGE,
            with: { media: { columns: { publicUrl: true } } },
          });
          if (rows.length === 0) break;
          let chunk = "";
          for (const r of rows) {
            chunk += csvRow([
              r.id,
              r.productId,
              r.rating,
              r.body,
              r.customerName,
              r.customerEmail,
              r.status,
              r.verified ? "yes" : "no",
              r.source,
              r.wixOrderId,
              r.reply,
              r.media.map((m) => m.publicUrl).join(" "),
              r.createdAt,
              r.publishedAt,
            ]);
          }
          controller.enqueue(encoder.encode(chunk));
          if (rows.length < PAGE) break;
          after = rows[rows.length - 1].id;
        }
        controller.close();
      } catch (err) {
        console.error(`[export] failed for ${instanceId}`, err);
        controller.error(err);
      }
    },
  });

  const day = new Date().toISOString().slice(0, 10);
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reviews-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
