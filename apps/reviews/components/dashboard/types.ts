export type Stats = {
  plan: string;
  totalReviews: number;
  pendingReviews: number;
  approvedReviews: number;
  avgRating: number;
  distribution: Record<string, number>;
  requestsScheduled: number;
  requestsSent: number;
  upgradeUrl: string;
  storeAddressMissing: boolean;
  photosEnabled: boolean;
  usage: {
    used: number;
    limit: number;
    skipped: number;
    level: "ok" | "warning" | "reached";
    resetsAt: string;
  };
};

export const PLAN_LABEL: Record<string, string> = {
  FREE: "Free",
  STARTER: "Starter",
  PRO: "Pro",
  GROWTH: "Growth",
};
