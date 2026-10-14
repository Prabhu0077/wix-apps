// Server-only: build and send one review request email (first ask or the
// single reminder). Shared by the daily cron and the "send me a test email"
// button so both use exactly the same wording and headers.

import { Resend } from "resend";

import { accounts } from "@/lib/db";
import { env } from "@/lib/env";
import { hasFeature } from "@/lib/features";
import { readSettings } from "@/lib/settings";
import { getStoreProfile } from "@/lib/store-profile";
import { getProductSummaries } from "@/lib/wix/catalog";
import { getWixClient } from "@/lib/wix/service";

import { renderReviewRequestEmail } from "./review-request";

type AccountRow = typeof accounts.$inferSelect;

export type EmailKind = "request" | "reminder";

let client: Resend | null = null;
export function resend(): Resend {
  client ??= new Resend(env.RESEND_API_KEY);
  return client;
}

/** Coupon percent to promise in the email, or null (plan or setting off). */
export function couponPercentFor(account: Pick<AccountRow, "plan" | "settings">): number | null {
  const s = readSettings(account.settings);
  return hasFeature(account.plan, "coupon") && s.couponEnabled ? s.couponPercent : null;
}

async function productNamesFor(account: AccountRow, productIds: string[]): Promise<string[]> {
  if (productIds.length === 0) return [];
  // Names are a nice-to-have; the email still goes if Wix can't be reached.
  try {
    const wix = await getWixClient(account.wixInstanceId);
    const found = await getProductSummaries(wix, account.wixInstanceId, productIds);
    return [...found.values()].map((p) => p.name);
  } catch (err) {
    console.warn(`[email] product names unavailable for ${account.wixInstanceId}:`, err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Send one review request email. `token` is the request's public token
 * ("demo" for a test email, which opens a form that saves nothing).
 * Throws if Resend refuses, so the caller can count the attempt.
 */
export async function sendReviewEmail(opts: {
  account: AccountRow;
  to: string;
  token: string;
  productIds: string[];
  kind: EmailKind;
  /** Test emails say so in the subject, so the merchant can't mistake them. */
  test?: boolean;
  /** Test emails use sample names instead of calling Wix. */
  productNames?: string[];
}): Promise<void> {
  const { account, to, token, kind } = opts;
  const settings = readSettings(account.settings);
  const profile = await getStoreProfile(account);
  const storeName = profile.storeName ?? settings.fromName;
  const productNames = opts.productNames ?? (await productNamesFor(account, opts.productIds));

  const base = env.NEXT_PUBLIC_APP_BASE_URL;
  const { subject, html, text } = renderReviewRequestEmail({
    storeName,
    productNames,
    reviewUrl: `${base}/review/${token}`,
    unsubscribeUrl: `${base}/unsubscribe/${token}`,
    storeAddress: profile.storeAddress,
    kind,
    couponPercent: couponPercentFor(account),
  });

  const result = await resend().emails.send({
    from: `${settings.fromName} <${env.RESEND_FROM_ADDRESS}>`,
    to,
    subject: opts.test ? `[Test] ${subject}` : subject,
    html,
    text,
    // One-click unsubscribe from the mail app (RFC 8058; Gmail and Yahoo
    // expect it from bulk senders). The POST needs no confirmation page.
    headers: {
      "List-Unsubscribe": `<${base}/api/public/unsubscribe/${token}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
  if (result.error) throw new Error(result.error.message);
}
