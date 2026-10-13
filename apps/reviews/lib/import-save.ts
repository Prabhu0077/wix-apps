// Server-only: insert imported reviews (CSV or Wix Reviews). Duplicates are
// skipped by the unique (account_id, source_ref) index, so running the same
// import twice adds nothing. Imports never count against the request limit.

import { inArray } from "drizzle-orm";

import { db, reviewMedia, reviews } from "@/lib/db";

export type ImportedReview = {
  productId: string;
  rating: number;
  body: string;
  name: string;
  email: string;
  writtenAt: Date | null;
  publishedAt: Date | null;
  status: "APPROVED" | "PENDING" | "REJECTED";
  verified: boolean;
  reply: string | null;
  photos: string[];
  incentivized: boolean;
  sourceRef: string;
};

/** Returns how many rows were new. */
export async function saveImported(accountId: string, items: ImportedReview[]): Promise<number> {
  if (items.length === 0) return 0;
  const now = new Date();
  const inserted = await db
    .insert(reviews)
    .values(
      items.map((r) => ({
        accountId,
        productId: r.productId,
        customerName: r.name,
        customerEmail: r.email,
        rating: r.rating,
        body: r.body,
        status: r.status,
        reply: r.reply,
        verified: r.verified,
        incentivized: r.incentivized,
        source: "IMPORT" as const,
        sourceRef: r.sourceRef,
        moderationFlags: [],
        // Keep the original date so imported reviews sort where they belong.
        createdAt: r.writtenAt ?? now,
        publishedAt: r.status === "APPROVED" ? (r.publishedAt ?? r.writtenAt ?? now) : null,
      })),
    )
    .onConflictDoNothing({ target: [reviews.accountId, reviews.sourceRef] })
    .returning({ id: reviews.id, sourceRef: reviews.sourceRef });

  // Photos stay where they are hosted (Wix Media or the old app's CDN); we
  // only link them. r2Key is empty so the purge job never tries to delete them.
  const photosByRef = new Map(items.map((r) => [r.sourceRef, r.photos]));
  const media = inserted.flatMap((row) =>
    (photosByRef.get(row.sourceRef ?? "") ?? []).map((url) => ({
      reviewId: row.id,
      kind: "PHOTO" as const,
      r2Key: "",
      publicUrl: url,
    })),
  );
  if (media.length > 0) {
    try {
      await db.insert(reviewMedia).values(media);
    } catch (err) {
      // Don't leave reviews half-imported: remove this batch so a retry is clean.
      await db.delete(reviews).where(inArray(reviews.id, inserted.map((r) => r.id)));
      throw err;
    }
  }
  return inserted.length;
}
