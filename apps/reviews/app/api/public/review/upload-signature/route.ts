// Generate pre-signed R2 (S3-compatible) upload URLs so the browser can
// upload media directly to Cloudflare R2 without routing through our server.
//
// The client calls this once per file, then PUT's to the returned URL.
// R2 credentials stay server-side — the browser never sees them.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import { env } from "@/lib/env";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
const EXPIRES_IN_SECONDS = 600; // 10 min to start the upload

const BodySchema = z.object({
  token: z.string().min(1),              // review request public token
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(100),
  sizeBytes: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
});

export async function POST(req: NextRequest) {
  // R2 must be configured
  if (
    !env.R2_ACCOUNT_ID ||
    !env.R2_ACCESS_KEY_ID ||
    !env.R2_SECRET_ACCESS_KEY ||
    !env.R2_BUCKET
  ) {
    return NextResponse.json(
      { error: "media_upload_unavailable", detail: "R2 not configured" },
      { status: 503 },
    );
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: "validation_failed", detail: String(err) }, { status: 400 });
  }

  // Validate content type
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/quicktime",
    "video/webm",
  ];
  if (!allowedTypes.includes(body.contentType)) {
    return NextResponse.json(
      { error: "unsupported_content_type", allowed: allowedTypes },
      { status: 400 },
    );
  }

  // Derive file extension from content type
  const extMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
  };
  const ext = extMap[body.contentType] ?? "bin";

  // Unique R2 key: reviews/<token>/<uuid>.<ext>
  const key = `reviews/${body.token}/${createId()}.${ext}`;

  // Dynamically import AWS SDK to avoid loading it when R2 is not configured
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    },
  });

  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET!,
    Key: key,
    ContentType: body.contentType,
    ContentLength: body.sizeBytes,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: EXPIRES_IN_SECONDS });

  return NextResponse.json({
    uploadUrl,
    key,
    publicUrl: `${env.R2_PUBLIC_BASE_URL}/${key}`,
    expiresIn: EXPIRES_IN_SECONDS,
  });
}
