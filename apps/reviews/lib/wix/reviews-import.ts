// Map a review from the native Wix Reviews app into our import shape (T8.2).
// Kept out of the route file: Next.js route files may only export handlers.

import type { ImportedReview } from "@/lib/import-save";

export type WixReview = {
  id?: string;
  entityId?: string;
  content?: { title?: string; body?: string; rating?: number; media?: { image?: { url?: string } }[] };
  author?: { authorName?: string };
  reply?: { message?: string };
  moderation?: { moderationStatus?: string };
  verified?: boolean;
  createdDate?: string;
  reviewDate?: string;
};
export type WixReviewsQueryResponse = { reviews?: WixReview[]; metadata?: { cursors?: { next?: string } } };

function toDate(s: string | undefined): Date | null {
  const t = s ? Date.parse(s) : NaN;
  return Number.isNaN(t) ? null : new Date(t);
}

export function mapWixReview(r: WixReview): ImportedReview | null {
  const rating = r.content?.rating;
  if (!r.id || !r.entityId || !rating || rating < 1 || rating > 5) return null;
  const title = (r.content?.title ?? "").trim();
  const text = (r.content?.body ?? "").trim();
  const body = title && text ? `${title}\n${text}` : title || text;
  if (!body) return null;
  const mod = r.moderation?.moderationStatus;
  const status = mod === "APPROVED" || mod === "SKIPPED" ? "APPROVED" : mod === "REJECTED" ? "REJECTED" : "PENDING";
  return {
    productId: r.entityId,
    rating,
    body: body.slice(0, 5000),
    name: (r.author?.authorName ?? "").trim().slice(0, 120) || "Customer",
    email: "",
    writtenAt: toDate(r.reviewDate) ?? toDate(r.createdDate),
    publishedAt: toDate(r.createdDate),
    status,
    verified: Boolean(r.verified),
    reply: (r.reply?.message ?? "").trim().slice(0, 1000) || null,
    photos: (r.content?.media ?? [])
      .map((m) => m.image?.url ?? "")
      .filter((u) => /^https:\/\//.test(u))
      .slice(0, 5),
    incentivized: false,
    sourceRef: `wix:${r.id}`,
  };
}

