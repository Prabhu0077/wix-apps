// Published reviews + summary + display settings, shared by the storefront
// pieces: product reviews section, rating badge, carousel, all-reviews page.

import { and, count, desc, eq } from "drizzle-orm";

import { db, accounts, reviews } from "@/lib/db";
import { touchMeta } from "@/lib/account-meta";
import { readSettings } from "@/lib/settings";

export type WidgetReview = {
  id: string;
  productId?: string;
  productName?: string;
  customerName: string;
  rating: number;
  body: string;
  reply: string | null;
  verified: boolean;
  imported: boolean;
  incentivized: boolean;
  helpful: number;
  writtenAt: string;
  media: { kind: string; url: string; thumbUrl: string }[];
};

export type Summary = { total: number; average: number; distribution: Record<number, number> };
export type Display = { theme: "light" | "dark"; starColor: string; photosFirst: boolean };

export type WidgetData = {
  reviews: WidgetReview[];
  summary: Summary;
  display: Display | null;
};

export const EMPTY_SUMMARY: Summary = { total: 0, average: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
export const EMPTY_WIDGET: WidgetData = { reviews: [], summary: EMPTY_SUMMARY, display: null };

const MAX_REVIEWS = 50;
type AccountRow = typeof accounts.$inferSelect;
type ReviewRow = typeof reviews.$inferSelect & { media: { kind: string; publicUrl: string; thumbUrl: string | null }[] };

export function toWidgetReview(r: ReviewRow): WidgetReview {
  return {
    id: r.id,
    productId: r.productId,
    customerName: r.customerName,
    rating: r.rating,
    body: r.body,
    reply: r.reply ?? null,
    verified: r.verified,
    imported: r.source === "IMPORT",
    incentivized: r.incentivized,
    helpful: r.helpfulCount,
    writtenAt: r.createdAt.toISOString(),
    media: r.media.map((m) => ({ kind: m.kind, url: m.publicUrl, thumbUrl: m.thumbUrl ?? m.publicUrl })),
  };
}

export function displayOf(account: AccountRow): Display {
  const s = readSettings(account.settings);
  return { theme: s.widgetTheme, starColor: s.starColor, photosFirst: s.showPhotosFirst };
}

/** Rating summary over ALL published reviews (not only the ones shown). */
export async function summarize(accountId: string, productId?: string): Promise<Summary> {
  const rows = await db
    .select({ rating: reviews.rating, n: count() })
    .from(reviews)
    .where(
      and(
        eq(reviews.accountId, accountId),
        eq(reviews.status, "APPROVED"),
        productId ? eq(reviews.productId, productId) : undefined,
      ),
    )
    .groupBy(reviews.rating);
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  let sum = 0;
  for (const r of rows) {
    const n = Number(r.n);
    distribution[r.rating] = n;
    total += n;
    sum += r.rating * n;
  }
  return { total, average: total ? Math.round((sum / total) * 10) / 10 : 0, distribution };
}

/** Live (installed) store for a public storefront request, or null. */
export async function storeFor(instanceId: string): Promise<AccountRow | null> {
  const account = await db.query.accounts.findFirst({ where: eq(accounts.wixInstanceId, instanceId) });
  return account && !account.uninstalledAt ? account : null;
}

/** Health check: the storefront is showing our widgets (recorded at most every 6 h). */
export function seen(account: AccountRow): () => Promise<void> {
  return () => touchMeta(account, "widgetSeenAt", 6 * 60 * 60 * 1000);
}

export async function loadWidgetData(
  instanceId: string,
  productId: string,
): Promise<{ data: WidgetData; markSeen: () => Promise<void> } | null> {
  const account = await storeFor(instanceId);
  if (!account) return null;

  const [published, summary] = await Promise.all([
    db.query.reviews.findMany({
      where: and(eq(reviews.accountId, account.id), eq(reviews.productId, productId), eq(reviews.status, "APPROVED")),
      // Newest written first; publish dates bunch up after bulk approval.
      orderBy: [desc(reviews.createdAt)],
      limit: MAX_REVIEWS,
      with: { media: true },
    }),
    summarize(account.id, productId),
  ]);

  return {
    data: { reviews: published.map(toWidgetReview), summary, display: displayOf(account) },
    markSeen: seen(account),
  };
}

/** Store-wide reviews, newest first (carousel and all-reviews page). */
export async function loadStoreReviews(
  account: AccountRow,
  limit: number,
  offset = 0,
): Promise<{ reviews: WidgetReview[]; hasMore: boolean }> {
  const rows = await db.query.reviews.findMany({
    where: and(eq(reviews.accountId, account.id), eq(reviews.status, "APPROVED")),
    orderBy: [desc(reviews.createdAt), desc(reviews.id)],
    limit: limit + 1,
    offset,
    with: { media: true },
  });
  return { reviews: rows.slice(0, limit).map(toWidgetReview), hasMore: rows.length > limit };
}

