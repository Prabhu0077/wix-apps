// Server-only: the merchant's current plan and this month's request usage.

import { and, eq, gte, sql } from "drizzle-orm";

import { db, accounts, reviewRequests } from "@/lib/db";
import { MONTHLY_REQUEST_LIMIT, monthStartUtc, nextMonthStartUtc, usageLevel, type Plan, type UsageLevel } from "@/lib/plans";
import { resolvePlan } from "@/lib/wix/service";

type AccountRow = typeof accounts.$inferSelect;

/**
 * Plan from Wix (Get App Instance), falling back to the stored plan if Wix
 * can't be reached. A changed plan is written back so the stored value stays
 * close to the truth for code paths that don't call Wix.
 */
export async function currentPlan(account: AccountRow): Promise<Plan> {
  const plan = await resolvePlan(account.wixInstanceId, account.plan);
  if (plan !== account.plan) {
    await db.update(accounts).set({ plan }).where(eq(accounts.id, account.id));
  }
  return plan;
}

export type RequestUsage = {
  plan: Plan;
  used: number; // requests scheduled this month (counted against the limit)
  skipped: number; // fulfilled orders this month that got no request because the limit was reached
  limit: number;
  level: UsageLevel;
  resetsAt: string; // ISO, start of next month UTC
};

export async function requestUsage(accountId: string, plan: Plan, now: Date = new Date()): Promise<RequestUsage> {
  const [row] = await db
    .select({
      used: sql<number>`count(*) filter (where ${reviewRequests.status} <> 'SKIPPED')`,
      skipped: sql<number>`count(*) filter (where ${reviewRequests.status} = 'SKIPPED')`,
    })
    .from(reviewRequests)
    .where(and(eq(reviewRequests.accountId, accountId), gte(reviewRequests.createdAt, monthStartUtc(now))));

  const used = Number(row?.used ?? 0);
  const limit = MONTHLY_REQUEST_LIMIT[plan];
  return {
    plan,
    used,
    skipped: Number(row?.skipped ?? 0),
    limit,
    level: usageLevel(used, limit),
    resetsAt: nextMonthStartUtc(now).toISOString(),
  };
}
