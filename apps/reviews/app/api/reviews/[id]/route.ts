// Per-review moderation.
// PATCH /api/reviews/[id]  body: { instance, action: "approve"|"reject"|"hide"|"reply", reply?: string }

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db, accounts, reviews } from "@/lib/db";
import { resolveInstanceId } from "@/lib/wix/instance";

export const runtime = "nodejs";

const ACTION_TO_STATUS = {
  approve: "APPROVED",
  reject: "REJECTED",
  hide: "HIDDEN",
} as const;

const BodySchema = z.object({
  instance: z.string().optional(),
  action: z.enum(["approve", "reject", "hide", "reply"]),
  reply: z.string().trim().max(1000).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { instance, action, reply } = parsed.data;

  const instanceId = resolveInstanceId(req.nextUrl.searchParams, req.headers.get("x-wix-instance"), instance);
  if (!instanceId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const account = await db.query.accounts.findFirst({ where: eq(accounts.wixInstanceId, instanceId) });
  if (!account) {
    return NextResponse.json({ error: "account_not_found" }, { status: 404 });
  }

  const review = await db.query.reviews.findFirst({ where: eq(reviews.id, id) });
  if (!review || review.accountId !== account.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (action === "reply") {
    if (!reply) return NextResponse.json({ error: "empty_reply" }, { status: 400 });
    await db.update(reviews).set({ reply }).where(eq(reviews.id, id));
    return NextResponse.json({ status: review.status, reply });
  }

  const status = ACTION_TO_STATUS[action];
  await db
    .update(reviews)
    .set({
      status,
      // Keep the first publish date so re-publishing doesn't reorder the widget.
      ...(status === "APPROVED" && !review.publishedAt ? { publishedAt: new Date() } : {}),
      ...(reply ? { reply } : {}),
    })
    .where(eq(reviews.id, id));

  return NextResponse.json({ status, reply: reply ?? review.reply });
}
