// Cron: send review requests that are due. Vercel calls this every 5 minutes
// (vercel.json) with `Authorization: Bearer <CRON_SECRET>`.
//
// A request that fails 5 times is marked FAILED and not retried, so one bad
// address can't loop forever or burn the email quota.

import { NextRequest, NextResponse } from "next/server";
import { and, eq, lte } from "drizzle-orm";
import { Resend } from "resend";

import { db, accounts, reviewRequests } from "@/lib/db";
import { env } from "@/lib/env";
import { renderReviewRequestEmail } from "@/lib/email/review-request";
import { readSettings } from "@/lib/settings";
import { getProductSummaries } from "@/lib/wix/catalog";
import { getWixClient } from "@/lib/wix/service";

export const runtime = "nodejs";
export const maxDuration = 60;

const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 5;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const due = await db.query.reviewRequests.findMany({
    where: and(eq(reviewRequests.status, "SCHEDULED"), lte(reviewRequests.scheduledFor, new Date())),
    limit: BATCH_SIZE,
  });

  let sent = 0;
  let failed = 0;

  for (const request of due) {
    try {
      const account = await db.query.accounts.findFirst({ where: eq(accounts.id, request.accountId) });
      if (!account) throw new Error(`account ${request.accountId} not found`);

      const settings = readSettings(account.settings);
      const storeName =
        typeof (account.settings as Record<string, unknown>)?.storeName === "string"
          ? ((account.settings as Record<string, unknown>).storeName as string)
          : settings.fromName;

      // Product names are a nice-to-have; send even if Wix can't be reached.
      let productNames: string[] = [];
      try {
        const client = await getWixClient(account.wixInstanceId);
        const found = await getProductSummaries(client, account.wixInstanceId, request.productIds as string[]);
        productNames = [...found.values()].map((p) => p.name);
      } catch (wixErr) {
        console.warn(`[cron] product names unavailable for ${request.id}:`, wixErr);
      }

      const { subject, html, text } = renderReviewRequestEmail({
        storeName,
        productNames,
        reviewUrl: `${env.NEXT_PUBLIC_APP_BASE_URL}/review/${request.publicToken}`,
      });

      const result = await resend.emails.send({
        from: `${settings.fromName} <${env.RESEND_FROM_ADDRESS}>`,
        to: request.customerEmail,
        subject,
        html,
        text,
      });
      if (result.error) throw new Error(result.error.message);

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

  return NextResponse.json({ due: due.length, sent, failed });
}
