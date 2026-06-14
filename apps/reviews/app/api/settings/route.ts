// Settings API
// GET  /api/settings?instanceId=X  — returns account settings
// POST /api/settings               — body: { instanceId, settings: {...} }
//
// Settings are stored as a jsonb column on reviews.accounts.

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, accounts } from "@/lib/db";

export const runtime = "nodejs";

export type AppSettings = {
  emailDelayDays: number;      // days after order before review request email
  fromName: string;            // sender name in email (e.g. "Store Team")
  widgetTheme: "light" | "dark" | "auto";
  showPhotosFirst: boolean;
  minRatingToPublish: 1 | 2 | 3 | 4 | 5;
};

const DEFAULT_SETTINGS: AppSettings = {
  emailDelayDays: 14,
  fromName: "The Store Team",
  widgetTheme: "auto",
  showPhotosFirst: false,
  minRatingToPublish: 1,
};

export async function GET(req: NextRequest) {
  const instanceId = req.nextUrl.searchParams.get("instanceId");
  if (!instanceId) return NextResponse.json({ error: "missing_instance_id" }, { status: 400 });

  const account = await db.query.accounts.findFirst({
    where: eq(accounts.wixInstanceId, instanceId),
  });

  if (!account) return NextResponse.json({ error: "account_not_found" }, { status: 404 });

  const stored = (account.settings ?? {}) as Partial<AppSettings>;
  return NextResponse.json({ settings: { ...DEFAULT_SETTINGS, ...stored } });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const { instanceId, settings } = body as { instanceId?: string; settings?: Partial<AppSettings> };
  if (!instanceId) return NextResponse.json({ error: "missing_instance_id" }, { status: 400 });

  const account = await db.query.accounts.findFirst({
    where: eq(accounts.wixInstanceId, instanceId),
  });

  if (!account) return NextResponse.json({ error: "account_not_found" }, { status: 404 });

  const current = (account.settings ?? {}) as Partial<AppSettings>;
  const updated: AppSettings = { ...DEFAULT_SETTINGS, ...current, ...(settings ?? {}) };

  // Validate ranges
  updated.emailDelayDays = Math.max(1, Math.min(60, updated.emailDelayDays));
  updated.fromName = (updated.fromName ?? "").slice(0, 60) || DEFAULT_SETTINGS.fromName;

  await db
    .update(accounts)
    .set({ settings: updated as Record<string, unknown> })
    .where(eq(accounts.id, account.id));

  return NextResponse.json({ settings: updated });
}
