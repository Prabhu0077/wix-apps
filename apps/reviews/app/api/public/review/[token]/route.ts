// Public review submission endpoint. Unauthenticated — token is the only
// proof the request is legitimate. Treat all input as hostile.

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

import { db, accounts, reviewRequests, reviews, reviewMedia } from "@/lib/db";
import { getProductSummaries, type ProductSummary } from "@/lib/wix/catalog";
import { getWixClient } from "@/lib/wix/service";
import { env } from "@/lib/env";
import { REVIEW_LINK_DAYS } from "@/lib/product";
import { readSettings } from "@/lib/settings";

function isExpired(createdAt: Date): boolean {
  return createdAt.getTime() < Date.now() - REVIEW_LINK_DAYS * 24 * 60 * 60 * 1000;
}

export const runtime = "nodejs";

// GET — fetch the prompt context (product info, customer email) for the form.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const request = await db.query.reviewRequests.findFirst({
    where: eq(reviewRequests.publicToken, token),
  });

  // SKIPPED (over the monthly limit) and FAILED requests were never emailed.
  if (!request || request.status === "SKIPPED" || request.status === "FAILED") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (isExpired(request.createdAt)) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  if (request.status === "COMPLETED") {
    return NextResponse.json({ error: "already_submitted" }, { status: 409 });
  }

  const account = await db.query.accounts.findFirst({
    where: eq(accounts.id, request.accountId),
  });
  const storeName =
    typeof (account?.settings as Record<string, unknown> | null)?.storeName === "string"
      ? ((account!.settings as Record<string, unknown>).storeName as string)
      : null;

  // Product names and images from Wix (Catalog V1 or V3). The form still
  // works with a generic label if Wix can't be reached.
  const productIds = request.productIds as string[];
  let found = new Map<string, ProductSummary>();
  if (account) {
    try {
      const wixClient = await getWixClient(account.wixInstanceId);
      found = await getProductSummaries(wixClient, account.wixInstanceId, productIds);
    } catch (err) {
      console.warn("[review/token] could not resolve product names:", err);
    }
  }
  const products = productIds.map((id) => found.get(id) ?? { id, name: "Your recent purchase" });

  // The shopper's email is not returned: the page never needs it.
  return NextResponse.json({ storeName, products });
}

const SubmitSchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().min(10, "Review must be at least 10 characters").max(5000),
  customerName: z.string().min(1, "Name is required").max(120),
  // Media is uploaded directly to R2 via signed URL — the client sends back the keys.
  mediaKeys: z
    .array(z.string().max(500))
    .max(6)
    .optional()
    .default([]),
});

// POST — actual review submission.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // Look up the ReviewRequest
  const request = await db.query.reviewRequests.findFirst({
    where: eq(reviewRequests.publicToken, token),
  });

  // SKIPPED (over the monthly limit) and FAILED requests were never emailed.
  if (!request || request.status === "SKIPPED" || request.status === "FAILED") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (isExpired(request.createdAt)) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  if (request.status === "COMPLETED") {
    return NextResponse.json({ error: "already_submitted" }, { status: 409 });
  }

  let body: z.infer<typeof SubmitSchema>;
  try {
    body = SubmitSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "validation_failed", detail: String(err) },
      { status: 400 },
    );
  }

  // Insert one Review per product in the order
  const productIds = request.productIds as string[];

  // We insert for the first product by default; expand to multi-product if needed
  const productId = productIds[0] ?? "unknown";

  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, request.accountId) });
  const autoPublish = readSettings(account?.settings).autoPublish;

  const [inserted] = await db
    .insert(reviews)
    .values({
      accountId: request.accountId,
      productId,
      wixOrderId: request.wixOrderId,
      customerName: body.customerName,
      customerEmail: request.customerEmail,
      rating: body.rating,
      body: body.body,
      // Auto-publish applies to every rating alike — never gate on rating.
      status: autoPublish ? "APPROVED" : "PENDING",
      publishedAt: autoPublish ? new Date() : null,
      moderationFlags: [],
      // Came through a token tied to a real Wix order.
      verified: true,
      source: "REQUEST",
    })
    .returning();

  // Attach media rows if any keys were provided
  if (body.mediaKeys && body.mediaKeys.length > 0 && env.R2_PUBLIC_BASE_URL) {
    await db.insert(reviewMedia).values(
      body.mediaKeys.map((key) => ({
        reviewId: inserted.id,
        kind: key.match(/\.(mp4|mov|webm)$/i) ? ("VIDEO" as const) : ("PHOTO" as const),
        r2Key: key,
        publicUrl: `${env.R2_PUBLIC_BASE_URL}/${key}`,
      })),
    );
  }

  // Mark the review request as COMPLETED
  await db
    .update(reviewRequests)
    .set({ status: "COMPLETED" })
    .where(eq(reviewRequests.id, request.id));

  return NextResponse.json({ ok: true, reviewId: inserted.id }, { status: 201 });
}
