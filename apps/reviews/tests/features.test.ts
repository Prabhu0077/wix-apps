// Run: pnpm test   (or: npx tsx tests/features.test.ts)
// Pure-logic checks for the Free and Starter extras: spam rules, plan gates,
// coupon spec, email variants, owner digest, storefront badge / carousel /
// all-reviews page, and the orders search used by "Ask recent customers".
// No database or network.
import assert from "node:assert/strict";

import { couponCode, couponSpec, createThankYouCoupon } from "@/lib/coupons";
import { digestAddress, renderDigestEmail } from "@/lib/email/digest";
import { renderReviewRequestEmail } from "@/lib/email/review-request";
import { FEATURE_MIN_PLAN, hasFeature } from "@/lib/features";
import { readSettings } from "@/lib/settings";
import { spamFlags } from "@/lib/spam";
import type { WidgetReview } from "@/lib/widget-data";
import { renderBadgeHtml, renderStoreReviewsHtml, renderWidgetHtml } from "@/lib/widget-html";
import type { WixClient } from "@/lib/wix/client";
import { fulfilledOrdersQuery, searchFulfilledOrders } from "@/lib/wix/orders";

const review = (over: Partial<WidgetReview> = {}): WidgetReview => ({
  id: "r1",
  customerName: "Priya S.",
  rating: 4,
  body: "Fits well and the fabric is soft.",
  reply: null,
  verified: true,
  imported: false,
  incentivized: false,
  helpful: 0,
  writtenAt: "2026-10-01T00:00:00Z",
  media: [],
  ...over,
});

async function main() {
  // ---------- Spam rules: content only, never the rating ----------
  assert.deepEqual(spamFlags("Lovely mug, keeps tea hot for an hour."), []);
  assert.deepEqual(spamFlags("great product.In use daily and no problems"), [], "missing space is not a link");
  assert.deepEqual(spamFlags("good product.in budget, worth it"), [], "bare .in is not treated as a link");
  assert.deepEqual(spamFlags("Treated with flame retardant, which I wanted."), [], "retardant is not abuse");
  assert.ok(spamFlags("Buy cheap at http://spam.example now").includes("link"));
  assert.ok(spamFlags("visit cheapdeals.xyz for more").includes("link"));
  assert.ok(spamFlags("Order from WWW.SHOP.EXAMPLE").includes("link"));
  assert.ok(spamFlags("Call me on +91 98765 43210 for a deal").includes("contact_details"));
  assert.ok(spamFlags("mail me at a.b@example.com please").includes("contact_details"));
  assert.ok(spamFlags("This is fucking rubbish honestly").includes("bad_language"));
  assert.ok(spamFlags("THIS IS THE WORST THING I HAVE EVER BOUGHT").includes("shouting"));
  assert.ok(spamFlags("good good good good good good").includes("repeated_text"));
  assert.ok(spamFlags("Amazinggggggggg product").includes("repeated_text"));
  assert.ok(spamFlags("Nice", "www.spam.example").includes("link"), "name is checked for links too");
  // A 1-star honest review is clean: the rating plays no part.
  assert.deepEqual(spamFlags("Broke after two days. Very disappointed with the quality."), []);

  // ---------- Plan gates ----------
  for (const f of Object.keys(FEATURE_MIN_PLAN) as (keyof typeof FEATURE_MIN_PLAN)[]) {
    assert.equal(hasFeature("FREE", f), false, `${f} is not free`);
    assert.equal(hasFeature("STARTER", f), true, `${f} on Starter`);
    assert.equal(hasFeature("GROWTH", f), true, `${f} on Growth`);
  }
  assert.equal(hasFeature(null, "coupon"), false);
  assert.equal(hasFeature("NONSENSE", "coupon"), false);

  // ---------- Settings defaults and bounds ----------
  const s = readSettings({ couponPercent: 80, reminderEnabled: "yes" });
  assert.equal(s.couponPercent, 10, "out-of-range percent falls back");
  assert.equal(s.reminderEnabled, true, "invalid value falls back to default");
  assert.equal(s.couponEnabled, false, "coupons are off until the merchant turns them on");
  assert.equal(s.notifyNewReviews, true);

  // ---------- Coupon ----------
  const code = couponCode();
  assert.match(code, /^THANKS-[A-HJ-NP-Z2-9]{8}$/);
  assert.notEqual(couponCode(), code);
  const spec = couponSpec("THANKS-AAAA2222", 15, 1_700_000_000_000).specification;
  assert.equal(spec.percentOffRate, 15);
  assert.equal(spec.usageLimit, 1);
  assert.equal(spec.scope.namespace, "stores");
  assert.equal(Number(spec.expirationTime) - Number(spec.startTime), 90 * 24 * 60 * 60 * 1000);
  let posted: { url: string; body: unknown } | null = null;
  const couponClient = {
    post: async (url: string, body: unknown) => {
      posted = { url, body };
      return { id: "c1" };
    },
  } as unknown as WixClient;
  const made = await createThankYouCoupon(couponClient, 20, 1_700_000_000_000);
  assert.ok(posted && (posted as { url: string }).url.endsWith("/stores/v2/coupons"));
  assert.equal(
    ((posted as unknown as { body: { specification: { code: string } } }).body.specification.code),
    made,
  );

  // ---------- Request, reminder and coupon emails ----------
  const base = {
    storeName: "Leaf & Co",
    productNames: ["Mug"],
    reviewUrl: "https://x/review/t",
    unsubscribeUrl: "https://x/unsubscribe/t",
    storeAddress: "1 High St",
  };
  const first = renderReviewRequestEmail(base);
  assert.equal(first.subject, "How was your order from Leaf & Co?");
  assert.ok(!first.text.includes("discount"));
  const reminder = renderReviewRequestEmail({ ...base, kind: "reminder" });
  assert.equal(reminder.subject, "A quick reminder from Leaf & Co");
  assert.ok(reminder.html.includes("Still happy to hear from you"));
  assert.ok(reminder.text.includes("Unsubscribe"), "reminder keeps the unsubscribe link");
  const withCoupon = renderReviewRequestEmail({ ...base, couponPercent: 15 });
  assert.ok(withCoupon.text.includes("15% discount code"));
  assert.ok(withCoupon.text.includes("good or bad"), "coupon promised for any rating");
  assert.ok(withCoupon.html.includes("Leaf &amp; Co"));

  // ---------- Owner digest ----------
  assert.equal(digestAddress("pending@example.com"), null);
  assert.equal(digestAddress("not an email"), null);
  assert.equal(digestAddress(" owner@shop.in "), "owner@shop.in");
  const digest = renderDigestEmail({
    storeName: "Leaf & Co",
    total: 7,
    pending: 2,
    latest: [{ customerName: "<b>Ann</b>", rating: 2, body: "x".repeat(400), status: "PENDING" }],
    manageUrl: "https://manage.wix.com/dashboard/site/app/app",
  });
  assert.equal(digest.subject, "7 new reviews for Leaf & Co");
  assert.ok(digest.text.includes("2 are waiting"));
  assert.ok(digest.text.includes("…and 6 more."));
  assert.ok(!digest.html.includes("<b>Ann</b>"), "names are escaped");
  assert.ok(digest.html.includes("★★☆☆☆"));

  // ---------- Storefront: product widget (star filter + helpful) ----------
  const widget = renderWidgetHtml(
    {
      reviews: [review({ helpful: 3 }), review({ id: "r2", rating: 2 })],
      summary: { total: 2, average: 3, distribution: { 4: 1, 2: 1 } },
      display: null,
    },
    new Date("2026-10-13T00:00:00Z"),
    "inst-1",
  );
  assert.ok(widget.includes('data-instance="inst-1"'));
  assert.ok(widget.includes('data-star="4"'), "rating bars filter by star");
  assert.ok(widget.includes("w-helpful"), "helpful button");
  assert.ok(widget.includes("Most helpful"), "sort by helpful (shown from 2 reviews)");
  assert.ok(widget.includes("/api/widget/helpful"));

  // ---------- Badge ----------
  const empty = renderBadgeHtml({ total: 0, average: 0, distribution: {} }, null);
  assert.ok(!empty.includes("w-badge\""), "no badge without reviews");
  const badge = renderBadgeHtml({ total: 28, average: 4.62, distribution: {} }, {
    theme: "dark",
    starColor: "#ff0000",
    photosFirst: false,
  });
  assert.ok(badge.includes("4.6") && badge.includes("(28 reviews)"));
  assert.ok(badge.includes('data-theme="dark"'));
  assert.ok(Buffer.byteLength(badge) < 15_000, "badge stays small");

  // ---------- Carousel and all-reviews page ----------
  const list = [
    review({ id: "a", rating: 5, productName: "Mug <b>", incentivized: true }),
    review({ id: "b", rating: 1, body: "Arrived chipped." }),
  ];
  const summary = { total: 2, average: 3, distribution: { 1: 1, 5: 1 } };
  const carousel = renderStoreReviewsHtml({ kind: "carousel", reviews: list, summary, display: null, instanceId: "i" });
  assert.ok(carousel.includes("Arrived chipped."), "low ratings are shown too");
  assert.ok(carousel.includes("Mug &lt;b&gt;"));
  assert.ok(carousel.includes("Received an incentive"));
  const all = renderStoreReviewsHtml({
    kind: "all",
    reviews: list,
    summary,
    display: null,
    instanceId: "i&x",
    page: 1,
    hasMore: true,
  });
  assert.ok(all.includes("Newer reviews") && all.includes("Older reviews"));
  assert.ok(all.includes("instanceId=i%26x&page=2"));
  const none = renderStoreReviewsHtml({ kind: "all", reviews: [], summary: { total: 0, average: 0, distribution: {} }, display: null, instanceId: "i" });
  assert.ok(!none.includes("class=\"w-title\""), "empty store renders nothing");

  // ---------- Orders search (Ask recent customers) ----------
  const since = new Date("2026-09-14T00:00:00Z");
  const q = fulfilledOrdersQuery(since);
  assert.deepEqual(q.search.filter, {
    status: "APPROVED",
    fulfillmentStatus: "FULFILLED",
    createdDate: { $gte: "2026-09-14T00:00:00.000Z" },
  });
  assert.equal(fulfilledOrdersQuery(since, "c2").search.cursorPaging.cursor, "c2");
  let calls = 0;
  const ordersClient = {
    post: async (_url: string, body: { search: { cursorPaging: { cursor?: string } } }) => {
      calls++;
      const cursor = body.search.cursorPaging.cursor;
      if (!cursor) return { orders: [{ id: "o1" }, { id: "o2" }, {}], metadata: { cursors: { next: "c2" } } };
      return { orders: [{ id: "o3" }], metadata: { cursors: { next: null } } };
    },
  } as unknown as WixClient;
  const found = await searchFulfilledOrders(ordersClient, since);
  assert.deepEqual(
    found.map((o) => o.id),
    ["o1", "o2", "o3"],
    "pages followed; orders without id dropped",
  );
  assert.equal(calls, 2);
  const capped = await searchFulfilledOrders(ordersClient, since, 1);
  assert.equal(capped.length, 1);

  console.log("features: all pass");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
