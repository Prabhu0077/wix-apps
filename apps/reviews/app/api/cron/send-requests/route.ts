// Daily cron (vercel.json, 09:00 UTC) with `Authorization: Bearer <CRON_SECRET>`.
// Three jobs, in order, each capped so the run stays inside maxDuration:
//   1. review requests that are due (every plan);
//   2. the single reminder, 7 days after a request with no review (Starter+);
//   3. the daily "new reviews" email to the store owner (every plan, opt-out).
//
// A request that fails 5 times is marked FAILED and not retried, so one bad
// address can't loop forever or burn the email quota. A reminder is tried
// once: reminderSentAt is set before sending, so a failure never repeats it.

import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gt, gte, inArray, isNull, lte, ne, sql } from "drizzle-orm";

import { readMetaTime, touchMeta } from "@/lib/account-meta";
import { db, accounts, reviewRequests, reviews } from "@/lib/db";
import { digestAddress, renderDigestEmail } from "@/lib/email/digest";
import { resend, sendReviewEmail } from "@/lib/email/send";
import { env } from "@/lib/env";
import { hasFeature, REMINDER_AFTER_DAYS } from "@/lib/features";
import { REVIEW_LINK_DAYS } from "@/lib/product";
import { readSettings } from "@/lib/settings";
import { getStoreProfile } from "@/lib/store-profile";
import { isSuppressed } from "@/lib/suppression";

export const runtime = "nodejs";
export const maxDuration = 60;

const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 5;
const DAY = 24 * 60 * 60 * 1000;
const DIGEST_BATCH = 100;

type AccountRow = typeof accounts.$inferSelect;

async function sendDue(now: Date) {
  const due = await db.query.reviewRequests.findMany({
    where: and(eq(reviewRequests.status, "SCHEDULED"), lte(reviewRequests.scheduledFor, now)),
    limit: BATCH_SIZE,
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const request of due) {
    try {
      const account = await db.query.accounts.findFirst({ where: eq(accounts.id, request.accountId) });
      if (!account) throw new Error(`account ${request.accountId} not found`);
      if (account.uninstalledAt) {
        await db
          .update(reviewRequests)
          .set({ status: "SKIPPED", skipReason: "uninstalled" })
          .where(eq(reviewRequests.id, request.id));
        skipped++;
        continue;
      }

      // The shopper may have unsubscribed after this request was scheduled.
      if (await isSuppressed(account.id, request.customerEmail)) {
        await db
          .update(reviewRequests)
          .set({ status: "SKIPPED", skipReason: "unsubscribed" })
          .where(eq(reviewRequests.id, request.id));
        skipped++;
        continue;
      }

      await sendReviewEmail({
        account,
        to: request.customerEmail,
        token: request.publicToken,
        productIds: request.productIds as string[],
        kind: "request",
      });

      await db
        .update(reviewRequests)
        .set({ status: "SENT", sentAt: new Date(), attempts: request.attempts + 1, lastError: null })
        .where(eq(reviewRequests.id, request.id));
      sent++;
    } catch (err) {
      failed++;
      const attempts = request.attempts + 1;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[cron] send failed for ${request.id} (attempt ${attempts}):`, message);
      await db
        .update(reviewRequests)
        .set({
          attempts,
          lastError: message.slice(0, 500),
          ...(attempts >= MAX_ATTEMPTS ? { status: "FAILED" as const } : {}),
        })
        .where(eq(reviewRequests.id, request.id));
    }
  }
  return { due: due.length, sent, failed, skipped };
}

async function sendReminders(now: Date) {
  // Sent 7+ days ago, no review yet, no reminder yet, link still valid with
  // a week to spare, paid plan, store still installed.
  const rows = await db
    .select({ request: reviewRequests, account: accounts })
    .from(reviewRequests)
    .innerJoin(accounts, eq(accounts.id, reviewRequests.accountId))
    .where(
      and(
        inArray(reviewRequests.status, ["SENT", "OPENED"]),
        isNull(reviewRequests.reminderSentAt),
        lte(reviewRequests.sentAt, new Date(now.getTime() - REMINDER_AFTER_DAYS * DAY)),
        gte(reviewRequests.createdAt, new Date(now.getTime() - (REVIEW_LINK_DAYS - 7) * DAY)),
        ne(accounts.plan, "FREE"),
        isNull(accounts.uninstalledAt),
      ),
    )
    .limit(BATCH_SIZE);

  let reminded = 0;
  let reminderFailed = 0;
  for (const { request, account } of rows) {
    if (!hasFeature(account.plan, "reminder") || !readSettings(account.settings).reminderEnabled) continue;
    // Claim first: a reminder is never sent twice, even if this run fails.
    const claimed = await db
      .update(reviewRequests)
      .set({ reminderSentAt: now })
      .where(and(eq(reviewRequests.id, request.id), isNull(reviewRequests.reminderSentAt)))
      .returning({ id: reviewRequests.id });
    if (claimed.length === 0) continue;
    if (await isSuppressed(account.id, request.customerEmail)) continue;
    try {
      await sendReviewEmail({
        account,
        to: request.customerEmail,
        token: request.publicToken,
        productIds: request.productIds as string[],
        kind: "reminder",
      });
      reminded++;
    } catch (err) {
      reminderFailed++;
      console.error(`[cron] reminder failed for ${request.id}:`, err instanceof Error ? err.message : err);
    }
  }
  return { reminded, reminderFailed };
}

async function sendDigest(account: AccountRow, now: Date): Promise<boolean> {
  const to = digestAddress(account.ownerEmail);
  if (!to || !readSettings(account.settings).notifyNewReviews) return false;
  const since = readMetaTime(account.settings, "lastDigestAt") ?? new Date(now.getTime() - DAY);

  // Imported reviews are left out: one import must not flood the inbox.
  const fresh = and(eq(reviews.accountId, account.id), gt(reviews.createdAt, since), ne(reviews.source, "IMPORT"));
  const [counts] = await db
    .select({
      total: sql<number>`count(*)`,
      pending: sql<number>`count(*) filter (where ${reviews.status} = 'PENDING')`,
    })
    .from(reviews)
    .where(fresh);
  const total = Number(counts?.total ?? 0);
  if (total === 0) return false;

  const latest = await db
    .select({ customerName: reviews.customerName, rating: reviews.rating, body: reviews.body, status: reviews.status })
    .from(reviews)
    .where(fresh)
    .orderBy(desc(reviews.createdAt))
    .limit(5);

  const profile = await getStoreProfile(account);
  const { subject, html, text } = renderDigestEmail({
    storeName: profile.storeName ?? "your store",
    total,
    pending: Number(counts?.pending ?? 0),
    latest,
    manageUrl: `https://manage.wix.com/dashboard/${account.siteId}/app/${env.WIX_APP_ID}`,
  });

  // Recorded first, so a failed send never repeats the same reviews tomorrow.
  await touchMeta(account, "lastDigestAt", 0);
  const result = await resend().emails.send({
    from: `Product Reviews <${env.RESEND_FROM_ADDRESS}>`,
    to,
    subject,
    html,
    text,
  });
  if (result.error) throw new Error(result.error.message);
  return true;
}

async function sendDigests(now: Date) {
  // Only stores with a new non-imported review in the last day are candidates.
  const ids = await db
    .selectDistinct({ accountId: reviews.accountId })
    .from(reviews)
    .where(and(gt(reviews.createdAt, new Date(now.getTime() - DAY)), ne(reviews.source, "IMPORT")))
    .limit(DIGEST_BATCH);
  if (ids.length === 0) return { digests: 0, digestFailed: 0 };

  const list = await db.query.accounts.findMany({
    where: and(
      inArray(
        accounts.id,
        ids.map((r) => r.accountId),
      ),
      isNull(accounts.uninstalledAt),
    ),
  });
  let digests = 0;
  let digestFailed = 0;
  for (const account of list) {
    try {
      if (await sendDigest(account, now)) digests++;
    } catch (err) {
      digestFailed++;
      console.error(`[cron] digest failed for ${account.id}:`, err instanceof Error ? err.message : err);
    }
  }
  return { digests, digestFailed };
}

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const requests = await sendDue(now);
  const reminders = await sendReminders(now);
  const digests = await sendDigests(now);
  return NextResponse.json({ ...requests, ...reminders, ...digests });
}
