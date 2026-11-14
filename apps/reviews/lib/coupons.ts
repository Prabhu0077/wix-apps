// Thank-you coupon for a review (Starter plan, PRD P1 "coupon rewards").
// Given for ANY honest review, whatever the rating, and the reviews are
// labelled "Received an incentive" (FTC rule, UK DMCC, PRD R12).
//
// Docs (checked 14 Oct 2026): POST https://www.wixapis.com/stores/v2/coupons
// { specification: { name, code, active, startTime, expirationTime,
//   usageLimit, scope: { namespace: "stores" }, percentOffRate } } -> { id }.
// Permission: Manage Coupons.

import { randomInt } from "crypto";

import type { WixClient } from "./wix/client";

const COUPONS_URL = "https://www.wixapis.com/stores/v2/coupons";
const VALID_DAYS = 90;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I

export function couponCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `THANKS-${s}`;
}

export function couponSpec(code: string, percent: number, now: number) {
  return {
    specification: {
      name: `Review thank-you ${code}`,
      code,
      active: true,
      startTime: String(now),
      expirationTime: String(now + VALID_DAYS * 24 * 60 * 60 * 1000),
      usageLimit: 1,
      scope: { namespace: "stores" },
      percentOffRate: percent,
    },
  };
}

/** Creates a single-use coupon and returns its code. Throws if Wix refuses. */
export async function createThankYouCoupon(client: WixClient, percent: number, now = Date.now()): Promise<string> {
  const code = couponCode();
  await client.post<{ id?: string }>(COUPONS_URL, couponSpec(code, percent, now));
  return code;
}

export const COUPON_VALID_DAYS = VALID_DAYS;
