// Per-review moderation actions
// PATCH /api/reviews/[id]  body: { instanceId, action: "approve"|"reject"|"hide", reply?: string }

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, accounts, reviews } from "@/lib/db";

export const runtime = "nodejs";

const ACTION_TO_STATUS = {
  approve: "APPROVED",
  reject:  "REJECTED",
  hide:    "HIDDEN",
} as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { instanceId, action, reply } = body as {
    instanceId?: string;
    action?: string;
    reply?: string;
  };

  if (!instanceId) {
    return NextResponse.json({ error: "missing_instance_id" }, { status: 400 });
  }

  if (!action || !(action in ACTION_TO_STATUS)) {
    return NextResponse.json(
      { error: "invalid_action", allowed: Object.keys(ACTION_TO_STATUS) },
      { status: 400 }
    );
  }

  // Verify the review belongs to this account
  const account = await db.query.accounts.findFirst({
    where: eq(accounts.wixInstanceId, instanceId),
  });

  if (!account) {
    return NextResponse.json({ error: "account_not_found" }, { status: 404 });
  }

  const review = await db.query.reviews.findFirst({
    where: eq(reviews.id, id),
  });

  if (!review || review.accountId !== account.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const newStatus = ACTION_TO_STATUS[action as keyof typeof ACTION_TO_STATUS];

  await db
    .update(reviews)
    .set({
      status: newStatus,
      ...(newStatus === "APPROVED" ? { publishedAt: new Date() } : {}),
      ...(reply !== undefined ? { reply } : {}),
    })
    .where(eq(reviews.id, id));

  return NextResponse.json({ success: true, status: newStatus });
}
