// Cron: delete stores that uninstalled the app more than PURGE_AFTER_DAYS ago
// (task T7.3; Wix review requirement and our privacy page: "deleted within
// 30 days of uninstall"). Vercel calls it daily (vercel.json) with
// `Authorization: Bearer <CRON_SECRET>`.
//
// Deleting the account row removes everything else by ON DELETE CASCADE:
// subscriptions, review requests, reviews, review media rows and the
// unsubscribe list. Photo files in R2 are deleted first, while we still know
// their keys. If R2 deletion fails, that store is left for tomorrow's run so
// no files are orphaned.

import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNotNull, lt } from "drizzle-orm";

import { db, accounts, reviewMedia, reviews } from "@/lib/db";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

// 29, not 30: the job runs once a day, so this keeps every deletion inside
// the 30 days we promise.
const PURGE_AFTER_DAYS = 29;
const MAX_ACCOUNTS_PER_RUN = 25;
const R2_BATCH = 1000; // S3 DeleteObjects limit

async function deleteR2Objects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET) {
    throw new Error("R2 is not configured but this store has media files");
  }
  const { S3Client, DeleteObjectsCommand } = await import("@aws-sdk/client-s3");
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
  });
  for (let i = 0; i < keys.length; i += R2_BATCH) {
    const batch = keys.slice(i, i + R2_BATCH);
    const res = await s3.send(
      new DeleteObjectsCommand({
        Bucket: env.R2_BUCKET,
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
      }),
    );
    if (res.Errors && res.Errors.length > 0) {
      throw new Error(`R2 refused ${res.Errors.length} deletions, e.g. ${res.Errors[0]?.Key}: ${res.Errors[0]?.Message}`);
    }
  }
}

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000);
  const due = await db.query.accounts.findMany({
    where: and(isNotNull(accounts.uninstalledAt), lt(accounts.uninstalledAt, cutoff)),
    columns: { id: true, wixInstanceId: true },
    limit: MAX_ACCOUNTS_PER_RUN,
  });

  let purged = 0;
  let failed = 0;
  for (const account of due) {
    try {
      const media = await db
        .select({ key: reviewMedia.r2Key })
        .from(reviewMedia)
        .innerJoin(reviews, eq(reviewMedia.reviewId, reviews.id))
        .where(eq(reviews.accountId, account.id));
      await deleteR2Objects(media.map((m) => m.key));

      // Re-check at delete time: a reinstall between the query and now clears
      // uninstalledAt, and then nothing is deleted.
      const deleted = await db
        .delete(accounts)
        .where(and(eq(accounts.id, account.id), lt(accounts.uninstalledAt, cutoff)))
        .returning({ id: accounts.id });
      if (deleted.length > 0) {
        purged++;
        console.log(`[purge] deleted all data for instance ${account.wixInstanceId}`);
      }
    } catch (err) {
      failed++;
      console.error(`[purge] could not purge instance ${account.wixInstanceId}:`, err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({ due: due.length, purged, failed });
}
