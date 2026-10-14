// Settings API
// GET  /api/settings?instance=<signed instance>
// POST /api/settings   body: { instance, settings: Partial<AppSettings> }

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db, accounts } from "@/lib/db";
import { readSettings, SettingsSchema, storeNameFrom } from "@/lib/settings";
import { currentPlan } from "@/lib/usage";
import { resolveInstanceId } from "@/lib/wix/instance";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const instanceId = resolveInstanceId(req.nextUrl.searchParams, req.headers.get("x-wix-instance"));
  if (!instanceId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const account = await db.query.accounts.findFirst({ where: eq(accounts.wixInstanceId, instanceId) });
  if (!account) return NextResponse.json({ error: "account_not_found" }, { status: 404 });

  // The plan decides which paid toggles are unlocked on the page. The
  // features themselves check the plan again when they run.
  const plan = await currentPlan(account).catch(() => account.plan);
  return NextResponse.json({ settings: readSettings(account.settings), storeName: storeNameFrom(account.settings), plan });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { instance?: string; settings?: unknown } | null;
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const instanceId = resolveInstanceId(req.nextUrl.searchParams, req.headers.get("x-wix-instance"), body.instance);
  if (!instanceId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const patch = SettingsSchema.partial().safeParse(body.settings ?? {});
  if (!patch.success) return NextResponse.json({ error: "invalid_settings" }, { status: 400 });

  const account = await db.query.accounts.findFirst({ where: eq(accounts.wixInstanceId, instanceId) });
  if (!account) return NextResponse.json({ error: "account_not_found" }, { status: 404 });

  // Keep non-settings keys (e.g. storeName set at install) that live in the same jsonb.
  const stored = (account.settings ?? {}) as Record<string, unknown>;
  const updated = { ...stored, ...readSettings(stored), ...patch.data };

  await db.update(accounts).set({ settings: updated }).where(eq(accounts.id, account.id));
  return NextResponse.json({ settings: readSettings(updated) });
}
