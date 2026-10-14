// "Was this helpful?" vote from the storefront widget. No login: one vote per
// voter per review, where the voter is a hash of IP + browser + review (never
// stored in clear). The count only goes up when the vote is new.
// POST { instanceId, reviewId } -> { ok, helpful }

import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db, accounts, reviews, reviewVotes } from "@/lib/db";
import { env } from "@/lib/env";

export const runtime = "nodejs";

const Body = z.object({ instanceId: z.string().min(1).max(100), reviewId: z.string().min(1).max(64) });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { instanceId, reviewId } = parsed.data;

  const account = await db.query.accounts.findFirst({ where: eq(accounts.wixInstanceId, instanceId), columns: { id: true } });
  if (!account) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const review = await db.query.reviews.findFirst({
    where: and(eq(reviews.id, reviewId), eq(reviews.accountId, account.id), eq(reviews.status, "APPROVED")),
    columns: { id: true, helpfulCount: true },
  });
  if (!review) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 200);
  // Salted with the cron secret so the hash can't be matched to an IP elsewhere.
  const voterHash = createHash("sha256").update(`${env.CRON_SECRET}|${ip}|${ua}|${reviewId}`).digest("hex");

  const added = await db
    .insert(reviewVotes)
    .values({ reviewId, voterHash })
    .onConflictDoNothing({ target: [reviewVotes.reviewId, reviewVotes.voterHash] })
    .returning({ id: reviewVotes.id });
  if (added.length === 0) return NextResponse.json({ ok: true, helpful: review.helpfulCount });

  const [row] = await db
    .update(reviews)
    .set({ helpfulCount: sql`${reviews.helpfulCount} + 1` })
    .where(eq(reviews.id, reviewId))
    .returning({ helpful: reviews.helpfulCount });
  return NextResponse.json({ ok: true, helpful: row?.helpful ?? review.helpfulCount + 1 });
}
