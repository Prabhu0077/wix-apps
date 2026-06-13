// Cron job: pick up scheduled review requests and send them via Resend.
//
// Vercel invokes this at the schedule defined in vercel.json (every 5 min).
// For development, hit GET /api/cron/send-requests with the correct bearer token.
//
// Security: CRON_SECRET must match the Authorization: Bearer <secret> header.
// Without this, anyone who discovers the URL can trigger mass emails.

import { NextRequest, NextResponse } from "next/server";
import { and, eq, lte } from "drizzle-orm";
import { Resend } from "resend";
import * as React from "react";

import { db, accounts, reviewRequests } from "@/lib/db";
import { env } from "@/lib/env";
import { getWixClient } from "@/lib/wix/service";
import { ReviewRequestEmail } from "@/lib/email/review-request";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Pro function timeout

const BATCH_SIZE = 50; // max emails per cron run to stay inside rate limits

export async function GET(req: NextRequest) {
  // Verify cron secret
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${env.CRON_SECRET}`;
  if (!auth || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const now = new Date();

  // Fetch up to BATCH_SIZE due requests
  const due = await db.query.reviewRequests.findMany({
    where: and(
      eq(reviewRequests.status, "SCHEDULED"),
      lte(reviewRequests.scheduledFor, now),
    ),
    limit: BATCH_SIZE,
  });

  if (due.length === 0) {
    return NextResponse.json({ sent: 0, message: "nothing due" });
  }

  let sent = 0;
  let failed = 0;
  const errors: { id: string; error: string }[] = [];

  for (const request of due) {
    try {
      // Fetch account to get store name + Wix tokens for product lookups
      const account = await db.query.accounts.findFirst({
        where: eq(accounts.id, request.accountId),
      });
      if (!account) {
        throw new Error(`Account ${request.accountId} not found`);
      }

      // Try to fetch product names from Wix. Fail gracefully — send email even
      // if product names can't be retrieved.
      let products: { id: string; name: string }[] = (request.productIds as string[]).map(
        (id) => ({ id, name: "your recent purchase" }),
      );

      try {
        const wixClient = await getWixClient(account.wixInstanceId);
        const productIds = request.productIds as string[];
        const resolved: { id: string; name: string }[] = [];
        for (const pid of productIds) {
          const res = await wixClient.get<{ product?: { name?: string } }>(
            `https://www.wixapis.com/stores/v1/products/${pid}`,
          );
          resolved.push({ id: pid, name: res?.product?.name ?? "your item" });
        }
        if (resolved.length > 0) products = resolved;
      } catch (wixErr) {
        console.warn(`[cron] could not fetch product names for request ${request.id}:`, wixErr);
      }

      // Build the public review URL
      const reviewUrl = `${env.NEXT_PUBLIC_APP_BASE_URL}/review/${request.publicToken}`;

      // Render HTML from the React email component
      const html = renderEmailToHtml({
        customerName: request.customerEmail.split("@")[0], // fallback name
        products,
        reviewUrl,
        storeName: account.ownerEmail.split("@")[1] ?? "Our Store",
      });

      // Send via Resend
      await resend.emails.send({
        from: env.RESEND_FROM_ADDRESS,
        to: request.customerEmail,
        subject: "How was your order? Share your review!",
        html,
      });

      // Mark as SENT
      await db
        .update(reviewRequests)
        .set({ status: "SENT", sentAt: new Date() })
        .where(eq(reviewRequests.id, request.id));

      sent++;
    } catch (err) {
      console.error(`[cron] failed to send review request ${request.id}:`, err);
      failed++;
      errors.push({ id: request.id, error: String(err) });
      // Don't mark as failed — it'll be picked up next run.
    }
  }

  console.log(`[cron] send-requests complete: ${sent} sent, ${failed} failed`);
  return NextResponse.json({ sent, failed, errors });
}

/** Minimal server-side HTML render without react-dom/server (edge-friendly). */
function renderEmailToHtml(props: {
  customerName: string;
  products: { id: string; name: string }[];
  reviewUrl: string;
  storeName: string;
}): string {
  // We render the JSX to a string manually to avoid importing react-dom/server
  // in an edge-compatible way. For richer templates, swap in @react-email/render.
  const productListItems = props.products
    .map((p) => `<li style="font-size:15px;line-height:1.8;color:#444">${escHtml(p.name)}</li>`)
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>How was your order?</title></head>
<body style="font-family:Arial,sans-serif;color:#333;margin:0;padding:0;background:#f9f9f9">
<div style="max-width:600px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
  <div style="background:#1a1a2e;padding:32px 40px;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:24px">${escHtml(props.storeName)}</h1>
  </div>
  <div style="padding:40px 40px 24px">
    <h2 style="font-size:22px;margin-top:0">Hi ${escHtml(props.customerName)}, how was your order?</h2>
    <p style="font-size:16px;line-height:1.6;color:#555">We hope you&apos;re enjoying your recent purchase! We&apos;d love to hear what you think.</p>
    ${props.products.length > 0 ? `<ul style="padding-left:20px;margin-bottom:24px">${productListItems}</ul>` : ""}
    <div style="text-align:center;margin:32px 0">
      <a href="${escHtml(props.reviewUrl)}" style="display:inline-block;background:#4f46e5;color:#fff;padding:14px 32px;border-radius:6px;font-size:16px;font-weight:bold;text-decoration:none">Write a Review</a>
    </div>
    <p style="font-size:13px;color:#aaa;text-align:center">This link is personal to you and expires in 30 days.</p>
  </div>
  <div style="background:#f3f3f3;padding:20px 40px;text-align:center">
    <p style="font-size:12px;color:#aaa;margin:0">You received this because you placed an order.</p>
  </div>
</div>
</body>
</html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
