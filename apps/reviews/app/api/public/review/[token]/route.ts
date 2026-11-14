// Public review submission endpoint. Unauthenticated — token is the only
// proof the request is legitimate. Treat all input as hostile.

import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db, accounts, reviewRequests, reviews, reviewMedia } from "@/lib/db";
import { getProductSummaries, type ProductSummary } from "@/lib/wix/catalog";
import { getWixClient } from "@/lib/wix/service";
import { env } from "@/lib/env";
import { createThankYouCoupon } from "@/lib/coupons";
import { hasFeature } from "@/lib/features";
import { MAX_PHOTOS_PER_REVIEW, r2Enabled } from "@/lib/r2";
import { spamFlags } from "@/lib/spam";
import { REVIEW_LINK_DAYS } from "@/lib/product";
import { readSettings, storeNameFrom } from "@/lib/settings";

function isExpired(createdAt: Date): boolean {
  return createdAt.getTime() < Date.now() - REVIEW_LINK_DAYS * 24 * 60 * 60 * 1000;
}

export const runtime = "nodejs";

// "demo" opens a sample form (used by the merchant's "Send me a test email").
// Nothing is read or saved for it.
const DEMO_TOKEN = "demo";

// GET — fetch the prompt context (product info, customer email) for the form.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (token === DEMO_TOKEN) {
    return NextResponse.json({
      storeName: "Your store",
      products: [{ id: "demo-1", name: "Sample product" }],
      photosEnabled: false,
      couponPercent: null,
      demo: true,
    });
  }

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
  const storeName = storeNameFrom(account?.settings);
  const settings = readSettings(account?.settings);
  // Told up front, for every rating alike (no review gating).
  const couponPercent =
    account && hasFeature(account.plan, "coupon") && settings.couponEnabled ? settings.couponPercent : null;

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
  return NextResponse.json({ storeName, products, photosEnabled: r2Enabled(), couponPercent });
}

// One block per product the shopper chose to review. Products they skip are
// simply absent. Text is required with a rating (PRD R2).
const ItemSchema = z.object({
  productId: z.string().min(1).max(200),
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(10, "Review must be at least 10 characters").max(5000),
  // Media is uploaded straight to R2 via signed URL; the client sends back the keys.
  mediaKeys: z.array(z.string().max(500)).max(MAX_PHOTOS_PER_REVIEW).optional().default([]),
});

const SubmitSchema = z.object({
  customerName: z.string().trim().min(1, "Name is required").max(120),
  items: z.array(ItemSchema).min(1).max(20),
});

// A request can be answered once, and only if it was (or is about to be) emailed.
const OPEN_STATUSES = ["SCHEDULED", "SENT", "OPENED"] as const;

// POST — submit reviews for one or more products in the order.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (token === DEMO_TOKEN) {
    // Validate like a real submit so the merchant sees real behaviour, save nothing.
    const parsed = SubmitSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
    return NextResponse.json({ ok: true, saved: parsed.data.items.length, demo: true }, { status: 201 });
  }

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
    return NextResponse.json({ error: "validation_failed", detail: String(err) }, { status: 400 });
  }

  // Every product must belong to this order, once; media keys must be ones
  // issued for this token (reviews/<token>/...), never another shopper's file.
  const orderProducts = new Set(request.productIds as string[]);
  const seen = new Set<string>();
  for (const item of body.items) {
    if (!orderProducts.has(item.productId) || seen.has(item.productId)) {
      return NextResponse.json({ error: "validation_failed", detail: "unknown_or_duplicate_product" }, { status: 400 });
    }
    seen.add(item.productId);
    if (item.mediaKeys.some((k) => !k.startsWith(`reviews/${token}/`) || k.includes("..") || !/^[\w/.-]+$/.test(k))) {
      return NextResponse.json({ error: "validation_failed", detail: "bad_media_key" }, { status: 400 });
    }
  }

  // Claim the request first so a double tap or a second tab can't save the
  // reviews twice. If saving then fails, the claim is undone.
  const claimed = await db
    .update(reviewRequests)
    .set({ status: "COMPLETED" })
    .where(and(eq(reviewRequests.id, request.id), inArray(reviewRequests.status, [...OPEN_STATUSES])))
    .returning({ id: reviewRequests.id });
  if (claimed.length === 0) {
    return NextResponse.json({ error: "already_submitted" }, { status: 409 });
  }

  let savedIds: string[] = [];
  try {
    const account = await db.query.accounts.findFirst({ where: eq(accounts.id, request.accountId) });
    const settings = readSettings(account?.settings);
    const couponOffered = !!account && hasFeature(account.plan, "coupon") && settings.couponEnabled;
    const now = new Date();

    const inserted = await db
      .insert(reviews)
      .values(
        body.items.map((item) => {
          // Content checks only (links, phone numbers, abuse...), never the
          // rating. A flagged review waits for the merchant even with auto-publish.
          const flags = spamFlags(item.body, body.customerName);
          const publish = settings.autoPublish && flags.length === 0;
          return {
          accountId: request.accountId,
          productId: item.productId,
          wixOrderId: request.wixOrderId,
          customerName: body.customerName,
          customerEmail: request.customerEmail,
          rating: item.rating,
          body: item.body,
          // Auto-publish applies to every rating alike — never gate on rating.
          status: publish ? ("APPROVED" as const) : ("PENDING" as const),
          publishedAt: publish ? now : null,
          moderationFlags: flags,
          // Came through a token tied to a real Wix order.
          verified: true,
          // A thank-you coupon was promised for reviewing: shown as "Incentive".
          incentivized: couponOffered,
          source: "REQUEST" as const,
          };
        }),
      )
      .returning({ id: reviews.id, productId: reviews.productId });
    savedIds = inserted.map((r) => r.id);

    const r2Base = env.R2_PUBLIC_BASE_URL;
    if (r2Base) {
      const idByProduct = new Map(inserted.map((r) => [r.productId, r.id]));
      const media = body.items.flatMap((item) =>
        item.mediaKeys.map((key) => ({
          reviewId: idByProduct.get(item.productId)!,
          kind: "PHOTO" as const, // video reviews are a later, paid feature
          r2Key: key,
          publicUrl: `${r2Base}/${key}`,
        })),
      );
      if (media.length > 0) await db.insert(reviewMedia).values(media);
    }

    // The reviews are saved. A coupon failure must not undo them.
    let couponCode: string | null = null;
    if (couponOffered && account) {
      try {
        const client = await getWixClient(account.wixInstanceId);
        couponCode = await createThankYouCoupon(client, settings.couponPercent);
        await db.update(reviewRequests).set({ couponCode }).where(eq(reviewRequests.id, request.id));
      } catch (err) {
        console.error(`[review/token] coupon failed for request ${request.id}`, err);
        couponCode = null;
      }
    }

    return NextResponse.json({ ok: true, saved: inserted.length, couponCode }, { status: 201 });
  } catch (err) {
    console.error(`[review/token] save failed for request ${request.id}`, err);
    // Undo partial work so the shopper can simply try again.
    if (savedIds.length > 0) {
      await db.delete(reviews).where(inArray(reviews.id, savedIds)).catch(() => undefined);
    }
    await db
      .update(reviewRequests)
      .set({ status: request.status })
      .where(eq(reviewRequests.id, request.id))
      .catch(() => undefined);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}
