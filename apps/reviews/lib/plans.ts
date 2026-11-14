// Plans and the one meter we charge on: review requests per month (PRD v2 §7).
// Safe to import from client and server code — no database access here.
//
// The month is the calendar month in UTC. Requests count when they are
// scheduled (the order is fulfilled), not when the email goes out, so a
// merchant can never be surprised by a send they didn't expect to pay for.

export const PLANS = ["FREE", "STARTER", "PRO", "GROWTH"] as const;
export type Plan = (typeof PLANS)[number];

export const MONTHLY_REQUEST_LIMIT: Record<Plan, number> = {
  FREE: 50,
  STARTER: 300,
  PRO: 1_500,
  GROWTH: 10_000,
};

/** Show the "close to your limit" warning from this share of the limit. */
export const WARN_AT_SHARE = 0.8;

export function isPlan(value: unknown): value is Plan {
  return typeof value === "string" && (PLANS as readonly string[]).includes(value);
}

/** First moment of the current month, UTC. */
export function monthStartUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** First moment of next month, UTC — when the counter resets. */
export function nextMonthStartUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

export type UsageLevel = "ok" | "warning" | "reached";

export function usageLevel(used: number, limit: number): UsageLevel {
  if (used >= limit) return "reached";
  if (used >= Math.ceil(limit * WARN_AT_SHARE)) return "warning";
  return "ok";
}
