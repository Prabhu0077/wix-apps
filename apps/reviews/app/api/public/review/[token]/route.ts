// Public review submission endpoint. Unauthenticated — token is the only
// proof the request is legitimate. Treat all input as hostile.

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

import { db, accounts, reviewRequests, reviews, reviewMedia } from "@/lib/db";
import { getWixClient } from "@/lib/wix/service";
import { env } from "@/lib/env";

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

  if (!request) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Expired if link is > 30 days old
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  if (request.createdAt < thirtyDaysAgo) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  if (request.status === "COMPLETED") {
    return NextResponse.json({ error: "already_submitted" }, { status: 409 });
  }

  // Try to resolve product names from Wix using the merchant's stored tokens.
  // Fail gracefully — the form still shows even if product names can't be fetched.
  const productIds = request.productIds as string[];
  let products: { id: string; name: string; imageUrl?: string }[] = productIds.map((id) => ({
    id,
    name: "Your Recent Purchase",
  }));

  try {
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, request.accountId),
    });
    if (account) {
      const wixClient = await getWixClient(account.wixInstanceId);
      const resolved: typeof products = [];
      for (const pid of productIds) {
        try {
          const res = await wixClient.get<{
            product?: { name?: string; media?: { mainMedia?: { image?: { url?: string } } } };
          }>(`https://www.wixapis.com/stores/v1/products/${pid}`);
          resolved.push({
            id: pid,
            name: res?.product?.name ?? "Your Recent Purchase",
            imageUrl: res?.product?.media?.mainMedia?.image?.url,
          });
        } catch {
          resolved.push({ id: pid, name: "Your Recent Purchase" });
        }
      }
      if (resolved.length > 0) products = resolved;
    }
  } catch (err) {
    console.warn("[review/token] could not resolve product names:", err);
  }

  return NextResponse.json({
    token,
    customerEmail: request.customerEmail,
    products,
    status: request.status,
  });
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

  if (!request) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Expired?
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  if (request.createdAt < thirtyDaysAgo) {
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
      status: "PENDING", // goes to moderation queue
      moderationFlags: [],
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
