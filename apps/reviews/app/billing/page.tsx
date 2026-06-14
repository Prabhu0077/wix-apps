"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

type Plan = "FREE" | "PRO" | "GROWTH";

const PLANS: {
  key: Plan;
  name: string;
  price: string;
  priceNote: string;
  color: string;
  badge: string;
  features: string[];
}[] = [
  {
    key: "FREE",
    name: "Free",
    price: "$0",
    priceNote: "forever",
    color: "#6b7280",
    badge: "bg-slate-700 text-slate-200",
    features: [
      "Up to 50 reviews stored",
      "Email review requests",
      "Basic moderation dashboard",
      "Widget on product pages",
      "NeoNerd branding on widget",
    ],
  },
  {
    key: "PRO",
    name: "Starter",
    price: "$9",
    priceNote: "/ month",
    color: "#7c3aed",
    badge: "bg-violet-700 text-violet-100",
    features: [
      "Unlimited reviews",
      "Remove NeoNerd branding",
      "Photo uploads (up to 5 per review)",
      "Reply to reviews",
      "Google Shopping structured data",
      "Priority email support",
    ],
  },
  {
    key: "GROWTH",
    name: "Growth",
    price: "$19",
    priceNote: "/ month",
    color: "#059669",
    badge: "bg-emerald-700 text-emerald-100",
    features: [
      "Everything in Starter",
      "Video reviews",
      "AI spam filter",
      "AI-generated reply suggestions",
      "CSV export",
      "Dedicated Slack support",
    ],
  },
];

function BillingContent() {
  const searchParams = useSearchParams();
  const instanceId = searchParams.get("instanceId");

  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPlan = useCallback(async () => {
    if (!instanceId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/stats?instanceId=${encodeURIComponent(instanceId)}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentPlan(data.plan as Plan);
      }
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  useEffect(() => { fetchPlan(); }, [fetchPlan]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading…</div>;
  }

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-white">Billing</h1>
        <p className="text-slate-400 text-sm mt-0.5">
          {currentPlan
            ? `You're on the ${PLANS.find((p) => p.key === currentPlan)?.name ?? currentPlan} plan.`
            : "Choose a plan to unlock more features."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = plan.key === currentPlan;
          return (
            <div
              key={plan.key}
              className={`relative bg-slate-800 border rounded-xl p-6 flex flex-col gap-4 transition-all ${
                isCurrent
                  ? "border-emerald-500 ring-1 ring-emerald-500/40"
                  : "border-slate-700 hover:border-slate-600"
              }`}
            >
              {isCurrent && (
                <span className="absolute -top-3 left-4 text-[10px] font-bold uppercase tracking-widest bg-emerald-600 text-white px-3 py-0.5 rounded-full">
                  Current plan
                </span>
              )}

              <div>
                <p className="text-white font-semibold text-base">{plan.name}</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-bold text-white">{plan.price}</span>
                  <span className="text-slate-400 text-sm">{plan.priceNote}</span>
                </div>
              </div>

              <ul className="space-y-2 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                    <svg className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="text-center text-xs text-slate-500 py-2 border border-slate-700 rounded-lg">
                  Active
                </div>
              ) : (
                <button
                  className="w-full py-2 rounded-lg text-sm font-semibold transition-colors"
                  style={{ background: plan.color, color: "#fff" }}
                  onClick={() => {
                    // Wix billing — open Wix upgrade flow
                    // In production: use Wix Billing API or Wix Pricing Plans
                    alert("Upgrade via Wix App Market → Manage Subscriptions.");
                  }}
                >
                  {(currentPlan === "FREE" && plan.key !== "FREE") ||
                  (currentPlan === "PRO" && plan.key === "GROWTH")
                    ? "Upgrade"
                    : "Switch Plan"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-2">
        <p className="text-white font-medium text-sm">Managing your subscription</p>
        <p className="text-slate-400 text-sm leading-relaxed">
          Subscriptions are managed through the Wix App Market. To upgrade, downgrade, or cancel, go to{" "}
          <strong className="text-slate-300">Wix Dashboard → App Market → Manage Apps</strong> and select Visual UGC Reviews.
        </p>
        <p className="text-slate-400 text-sm">
          Questions?{" "}
          <a href="/support" className="text-sky-400 hover:underline" target="_blank">
            Visit our support page
          </a>
          {" or email "}
          <a href="mailto:chandra.prabhakar12@gmail.com" className="text-sky-400 hover:underline">
            chandra.prabhakar12@gmail.com
          </a>
        </p>
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading…</div>}>
      <BillingContent />
    </Suspense>
  );
}
