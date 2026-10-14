// Which plan unlocks which feature (PRD v2 §7). Client- and server-safe.
// Reviews are never hidden by plan: only extras are gated.

import type { Plan } from "@/lib/plans";

export type Feature = "reminder" | "coupon" | "carousel" | "allReviewsPage";

const RANK: Record<Plan, number> = { FREE: 0, STARTER: 1, PRO: 2, GROWTH: 3 };

export const FEATURE_MIN_PLAN: Record<Feature, Plan> = {
  reminder: "STARTER",
  coupon: "STARTER",
  carousel: "STARTER",
  allReviewsPage: "STARTER",
};

export function hasFeature(plan: string | null | undefined, feature: Feature): boolean {
  const p = (plan ?? "FREE") as Plan;
  return (RANK[p] ?? 0) >= RANK[FEATURE_MIN_PLAN[feature]];
}

/** The one reminder goes this many days after the first email, if no review yet. */
export const REMINDER_AFTER_DAYS = 7;
