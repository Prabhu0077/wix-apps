"use client";

// Plans from PRD v2 §7. Prices and limits are shown here for clarity; the
// source of truth is the plan setup in the Wix app dashboard, and every
// purchase goes through Wix's own upgrade page (Wix Billing is mandatory).

import { Suspense, useEffect, useState } from "react";

import { PLAN_LABEL, type Stats } from "@/components/dashboard/types";
import { UsageCard } from "@/components/dashboard/UsageCard";
import { api, ApiError, useInstance } from "@/lib/dashboard-client";

// `soon` marks features that are planned but not built yet. They are labelled
// in the UI so merchants never pay for something that doesn't exist.
type Feature = { text: string; soon?: boolean };

const PLANS: { key: string; price: string; quota: string; features: Feature[] }[] = [
  {
    key: "FREE",
    price: "$0",
    quota: "50 review requests a month",
    features: [
      { text: "Photo reviews", soon: true },
      { text: "Verified buyer badge" },
      { text: "Product page reviews" },
      { text: "Import and export, always", soon: true },
    ],
  },
  {
    key: "STARTER",
    price: "$9",
    quota: "300 review requests a month",
    features: [
      { text: "Everything in Free" },
      { text: "Reminder email", soon: true },
      { text: "Reviews carousel and all-reviews page", soon: true },
      { text: "Thank-you coupons", soon: true },
    ],
  },
  {
    key: "PRO",
    price: "$29",
    quota: "1,500 review requests a month",
    features: [
      { text: "Everything in Starter" },
      { text: "Video reviews", soon: true },
      { text: "Star ratings in Google Shopping", soon: true },
    ],
  },
  {
    key: "GROWTH",
    price: "$79",
    quota: "10,000 review requests a month",
    features: [
      { text: "Everything in Pro" },
      { text: "Emails in your customers' language", soon: true },
      { text: "Priority support" },
    ],
  },
];

function Plan() {
  const instance = useInstance();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Stats>(instance, "/api/stats")
      .then(setStats)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Couldn't load your plan."));
  }, [instance]);

  if (error) return <div className="notice notice-error">{error}</div>;
  if (!stats) return <div className="loading">Loading your plan…</div>;

  return (
    <div className="stack">
      <UsageCard stats={stats} />

      <section className="card" aria-labelledby="plans-title">
        <div className="card-head">
          <div>
            <h2 className="card-title" id="plans-title">
              You&apos;re on the {PLAN_LABEL[stats.plan] ?? stats.plan} plan
            </h2>
            <p className="card-sub">
              Your reviews stay on your store whatever plan you&apos;re on. We warn you here at 80% of your monthly
              requests; at the limit, new orders aren&apos;t asked for a review until next month or until you upgrade.
            </p>
          </div>
        </div>
        <div className="plans">
          {PLANS.map((p) => {
            const current = p.key === stats.plan;
            return (
              <div key={p.key} className={`plan${current ? " plan-current" : ""}`}>
                <div className="plan-name">{PLAN_LABEL[p.key]}</div>
                <div className="plan-price">
                  {p.price}
                  <small> / month</small>
                </div>
                <div className="plan-quota">{p.quota}</div>
                <ul className="plan-list">
                  {p.features.map((f) => (
                    <li key={f.text}>
                      {f.text}
                      {f.soon && <span className="rsmall"> (coming soon)</span>}
                    </li>
                  ))}
                </ul>
                {current ? (
                  <span className="badge badge-approved" style={{ justifySelf: "start" }}>
                    Your plan
                  </span>
                ) : p.key !== "FREE" ? (
                  <a className="btn btn-secondary btn-sm" href={stats.upgradeUrl} target="_top">
                    Choose {PLAN_LABEL[p.key]}
                  </a>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
      <p className="help">
        Payments, invoices and cancellations are handled by Wix. Yearly billing is available on Wix&apos;s checkout page.
      </p>
    </div>
  );
}

export default function PlanPage() {
  return (
    <Suspense fallback={<div className="loading">Loading your plan…</div>}>
      <Plan />
    </Suspense>
  );
}
