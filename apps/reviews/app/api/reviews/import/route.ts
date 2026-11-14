// CSV review import (PRD R8, task T8.1).
// POST { instance, publish, rows: ImportRow[] }  (max 500 rows per call)
// -> { imported, duplicates, failed: [{ line, reason }] }
//
// The browser parses the file and maps columns; this endpoint validates each
// row again, matches the product (ID -> SKU -> slug/URL -> name) and saves.
// The browser sends big files in batches of 500, so there is no row limit.

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db, accounts } from "@/lib/db";
import { cleanRow } from "@/lib/import";
import { saveImported, type ImportedReview } from "@/lib/import-save";
import { buildProductIndex } from "@/lib/product-match";
import { listCatalogProducts } from "@/lib/wix/catalog";
import { resolveInstanceId } from "@/lib/wix/instance";
import { getWixClient } from "@/lib/wix/service";

export const runtime = "nodejs";
export const maxDuration = 60;

const cell = z.string().max(6000).optional();
const BodySchema = z.object({
  instance: z.string().optional(),
  publish: z.boolean(),
  rows: z
    .array(
      z.object({
        line: z.number().int().min(1),
        product: cell,
        rating: cell,
        body: cell,
        title: cell,
        name: cell,
        email: cell,
        date: cell,
        verified: cell,
        reply: cell,
        photos: cell,
        incentivized: cell,
      }),
    )
    .min(1)
    .max(500),
});

export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const body = parsed.data;

  const instanceId = resolveInstanceId(req.nextUrl.searchParams, req.headers.get("x-wix-instance"), body.instance);
  if (!instanceId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const account = await db.query.accounts.findFirst({ where: eq(accounts.wixInstanceId, instanceId) });
  if (!account) return NextResponse.json({ error: "account_not_found" }, { status: 404 });

  let match;
  try {
    match = buildProductIndex(await listCatalogProducts(await getWixClient(instanceId), instanceId));
  } catch (err) {
    console.error(`[import] catalog unavailable for ${instanceId}`, err);
    return NextResponse.json({ error: "catalog_unavailable" }, { status: 502 });
  }

  const failed: { line: number; reason: string }[] = [];
  const ready: ImportedReview[] = [];
  const seenRefs = new Set<string>();
  const now = new Date();

  for (const row of body.rows) {
    const c = cleanRow(row, now);
    if (!c.ok) {
      failed.push({ line: row.line, reason: c.reason });
      continue;
    }
    const product = match(c.review.productKey);
    if (!product) {
      failed.push({ line: row.line, reason: `No product matches "${c.review.productKey.slice(0, 80)}"` });
      continue;
    }
    if (seenRefs.has(c.review.sourceRef)) continue; // same row twice in this batch
    seenRefs.add(c.review.sourceRef);
    ready.push({
      ...c.review,
      productId: product.id,
      status: body.publish ? "APPROVED" : "PENDING",
      publishedAt: null,
    });
  }

  try {
    const imported = await saveImported(account.id, ready);
    return NextResponse.json({ imported, duplicates: ready.length - imported, failed });
  } catch (err) {
    console.error(`[import] save failed for ${instanceId}`, err);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}
