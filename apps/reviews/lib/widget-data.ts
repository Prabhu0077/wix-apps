// Published reviews + summary + display settings for one product, shared by
// the storefront widget page and its JSON API.

import { and, desc, eq } from "drizzle-orm";

import { db, accounts, reviews } from "@/lib/db";
import { touchMeta } from "@/lib/account-meta";
import { readSettings } from "@/lib/settings";

export type WidgetReview = {
  id: string;
  customerName: string;
  rating: number;
  body: string;
  reply: string | null;
  verified: boolean;
  imported: boolean;
  incentivized: boolean;
  writtenAt: string;
  media: { kind: string; url: string; thumbUrl: string }[];
};

export type WidgetData = {
  reviews: WidgetReview[];
  summary: { total: number; average: number; distribution: Record<number, number> };
  display: { theme: "light" | "dark"; starColor: string; photosFirst: boolean } | null;
};

export const EMPTY_WIDGET: WidgetData = {
  reviews: [],
  summary: { total: 0, average: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
  display: null,
};

const MAX_REVIEWS = 50;

/**
 * Returns null when the store is unknown or uninstalled (the widget then
 * renders nothing). `onSeen` lets the caller record the health-check
 * timestamp after the response is sent.
 */
export async function loadWidgetData(
  instanceId: string,
  productId: string,
): Promise<{ data: WidgetData; markSeen: () => Promise<void> } | null> {
  const account = await db.query.accounts.findFirst({ where: eq(accounts.wixInstanceId, instanceId) });
  if (!account || account.uninstalledAt) return null;

  const settings = readSettings(account.settings);
  const published = await db.query.reviews.findMany({
    where: and(eq(reviews.accountId, account.id), eq(reviews.productId, productId), eq(reviews.status, "APPROVED")),
    // Newest written first; publish dates bunch up after bulk approval.
    orderBy: [desc(reviews.createdAt)],
    limit: MAX_REVIEWS,
    with: { media: true },
  });

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  for (const r of published) {
    sum += r.rating;
    distribution[r.rating] = (distribution[r.rating] ?? 0) + 1;
  }
  const total = published.length;

  return {
    data: {
      reviews: published.map((r) => ({
        id: r.id,
        customerName: r.customerName,
        rating: r.rating,
        body: r.body,
        reply: r.reply ?? null,
        verified: r.verified,
        imported: r.source === "IMPORT",
        incentivized: r.incentivized,
        writtenAt: r.createdAt.toISOString(),
        media: r.media.map((m) => ({ kind: m.kind, url: m.publicUrl, thumbUrl: m.thumbUrl ?? m.publicUrl })),
      })),
      summary: { total, average: total ? Math.round((sum / total) * 10) / 10 : 0, distribution },
      display: { theme: settings.widgetTheme, starColor: settings.starColor, photosFirst: settings.showPhotosFirst },
    },
    // Health check: the widget is live on the store (recorded at most every 6 h).
    markSeen: () => touchMeta(account, "widgetSeenAt", 6 * 60 * 60 * 1000),
  };
}
