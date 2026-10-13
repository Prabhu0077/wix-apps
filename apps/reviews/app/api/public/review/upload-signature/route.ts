// Pre-signed R2 upload URL for one review photo, so the shopper's browser
// uploads straight to Cloudflare R2 and R2 keys never reach the browser.
// POST { token, contentType, sizeBytes } -> { uploadUrl, key, publicUrl }
//
// B15 fix: the token must belong to an open review request (emailed, not yet
// answered, not expired), photos only, 10 MB max. The key is
// reviews/<token>/<random>.<ext>, and the submit endpoint only accepts keys
// under that token's prefix.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";

import { db, reviewRequests } from "@/lib/db";
import { env } from "@/lib/env";
import { REVIEW_LINK_DAYS } from "@/lib/product";
import { MAX_PHOTO_BYTES, PHOTO_TYPES, r2Client, r2Enabled } from "@/lib/r2";

export const runtime = "nodejs";

const EXPIRES_IN_SECONDS = 600; // 10 min to start the upload

const BodySchema = z.object({
  token: z.string().min(1).max(64),
  contentType: z.string().min(1).max(100),
  sizeBytes: z.number().int().positive().max(MAX_PHOTO_BYTES),
});

export async function POST(req: NextRequest) {
  if (!r2Enabled()) {
    return NextResponse.json({ error: "media_upload_unavailable" }, { status: 503 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  const { token, contentType, sizeBytes } = parsed.data;

  const ext = PHOTO_TYPES[contentType];
  if (!ext) {
    return NextResponse.json({ error: "unsupported_content_type", allowed: Object.keys(PHOTO_TYPES) }, { status: 400 });
  }

  const request = await db.query.reviewRequests.findFirst({
    where: eq(reviewRequests.publicToken, token),
    columns: { status: true, createdAt: true },
  });
  const open =
    request &&
    (request.status === "SCHEDULED" || request.status === "SENT" || request.status === "OPENED") &&
    request.createdAt.getTime() >= Date.now() - REVIEW_LINK_DAYS * 24 * 60 * 60 * 1000;
  if (!open) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const key = `reviews/${token}/${createId()}.${ext}`;
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const uploadUrl = await getSignedUrl(
    await r2Client(),
    new PutObjectCommand({ Bucket: env.R2_BUCKET!, Key: key, ContentType: contentType, ContentLength: sizeBytes }),
    { expiresIn: EXPIRES_IN_SECONDS },
  );

  return NextResponse.json({ uploadUrl, key, publicUrl: `${env.R2_PUBLIC_BASE_URL}/${key}`, expiresIn: EXPIRES_IN_SECONDS });
}
