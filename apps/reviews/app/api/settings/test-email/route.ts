// "Send me a test email" (Free): sends the real review request email, with
// the merchant's current settings, to the store owner's own address. The
// links open a sample form and unsubscribe page that save nothing.
//
// POST /api/settings/test-email  body: { instance, kind?: "request" | "reminder" }
// At most one per minute per store.

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { readMetaTime, touchMeta } from "@/lib/account-meta";
import { db, accounts } from "@/lib/db";
import { digestAddress } from "@/lib/email/digest";
import { sendReviewEmail } from "@/lib/email/send";
import { resolveInstanceId } from "@/lib/wix/instance";

export const runtime = "nodejs";

const ONCE_PER_MS = 60 * 1000;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { instance?: string; kind?: string };
  const instanceId = resolveInstanceId(req.nextUrl.searchParams, req.headers.get("x-wix-instance"), body.instance);
  if (!instanceId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const account = await db.query.accounts.findFirst({ where: eq(accounts.wixInstanceId, instanceId) });
  if (!account || account.uninstalledAt) return NextResponse.json({ error: "account_not_found" }, { status: 404 });

  const to = digestAddress(account.ownerEmail);
  if (!to) return NextResponse.json({ error: "no_owner_email" }, { status: 409 });

  const last = readMetaTime(account.settings, "testEmailAt");
  if (last && Date.now() - last.getTime() < ONCE_PER_MS) {
    return NextResponse.json({ error: "too_soon" }, { status: 429 });
  }
  await touchMeta(account, "testEmailAt", 0);

  try {
    await sendReviewEmail({
      account,
      to,
      token: "demo",
      productIds: [],
      productNames: ["Sample product"],
      kind: body.kind === "reminder" ? "reminder" : "request",
      test: true,
    });
  } catch (err) {
    console.error(`[test-email] failed for ${instanceId}:`, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "email_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, sentTo: to });
}
