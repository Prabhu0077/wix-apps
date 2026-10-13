// Unsubscribe from one store's review request emails (task T1.6).
//
// GET  -> { storeName, unsubscribed } for the confirmation page.
// POST -> adds the shopper to the store's suppression list. Used both by our
//         page (JSON) and by mail apps' one-click button (RFC 8058 sends
//         `List-Unsubscribe=One-Click` as a form body). Idempotent.
//
// The token is the review request's public token; it identifies one shopper
// at one store. Unsubscribing keeps working after the review link expires.
// We never return the email address.

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db, accounts, reviewRequests } from "@/lib/db";
import { storeNameFrom } from "@/lib/settings";
import { isSuppressed, suppress } from "@/lib/suppression";

export const runtime = "nodejs";

async function load(token: string) {
  if (!token || token.length > 64) return null;
  const request = await db.query.reviewRequests.findFirst({ where: eq(reviewRequests.publicToken, token) });
  if (!request) return null;
  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, request.accountId) });
  if (!account) return null;
  return { request, account };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const found = await load((await params).token);
  if (!found) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({
    storeName: storeNameFrom(found.account.settings),
    unsubscribed: await isSuppressed(found.account.id, found.request.customerEmail),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const found = await load((await params).token);
  if (!found) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const oneClick = (req.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded");
  await suppress(found.account.id, found.request.customerEmail, oneClick ? "one_click" : "link");
  return NextResponse.json({ ok: true, storeName: storeNameFrom(found.account.settings) });
}
