"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

type Stats = {
  plan: string;
  totalReviews: number;
  pendingReviews: number;
  approvedReviews: number;
  requestsSent: number;
  avgRating: number;
};

const PLAN_BADGE: Record<string, string> = {
  FREE:   "bg-slate-700 text-slate-200",
  PRO:    "bg-violet-700 text-violet-100",
  GROWTH: "bg-emerald-700 text-emerald-100",
};

function Star({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className={`w-4 h-4 ${filled ? "text-amber-400" : "text-slate-600"}`} fill="currentColor">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.956a1 1 0 00.95.69h4.162c.969 0 1.372 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.197-1.54-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.062 9.383c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69L9.049 2.927z" />
    </svg>
  );
}

function OverviewContent() {
  const searchParams = useSearchParams();
  const instance = searchParams.get("instance");

  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!instance) {
      setError("No instance — open this app from your Wix dashboard.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/stats?instance=${encodeURIComponent(instance)}`);
      if (!res.ok) {
        const { error: msg } = await res.json();
        setError(msg ?? "Failed to load stats");
        return;
      }
      setStats(await res.json());
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }, [instance]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Loading…
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-6 text-red-400 text-sm">
        {error ?? "Something went wrong."}
      </div>
    );
  }

  const statCards = [
    { label: "Total Reviews",    value: stats.totalReviews,    sub: "all time",          color: "text-white" },
    { label: "Pending Approval", value: stats.pendingReviews,  sub: "need your review",  color: "text-amber-400" },
    { label: "Published",        value: stats.approvedReviews, sub: "live on your store", color: "text-emerald-400" },
    { label: "Emails Sent",      value: stats.requestsSent,    sub: "review requests",   color: "text-sky-400" },
  ];

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Overview</h1>
          <p className="text-slate-400 text-sm mt-0.5">NeoReviewKit — your store at a glance</p>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wide ${PLAN_BADGE[stats.plan] ?? PLAN_BADGE.FREE}`}>
          {stats.plan}
        </span>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-4">
        {statCards.map((c) => (
          <div key={c.label} className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-1">
            <p className="text-xs text-slate-400 uppercase tracking-wide">{c.label}</p>
            <p className={`text-3xl font-bold tabular-nums ${c.color}`}>{c.value.toLocaleString()}</p>
            <p className="text-xs text-slate-500">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Average rating */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Average Rating</p>
        <div className="flex items-center gap-3">
          <span className="text-4xl font-bold text-amber-400 tabular-nums">{stats.avgRating.toFixed(1)}</span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} filled={n <= Math.round(stats.avgRating)} />
            ))}
          </div>
          <span className="text-slate-500 text-sm">({stats.approvedReviews} published)</span>
        </div>
      </div>

      {/* Pending CTA */}
      {stats.pendingReviews > 0 && (
        <div className="bg-amber-950 border border-amber-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-amber-300 font-medium text-sm">
              {stats.pendingReviews} review{stats.pendingReviews > 1 ? "s" : ""} waiting for approval
            </p>
            <p className="text-amber-500 text-xs mt-0.5">Publish them to show on your product pages</p>
          </div>
          <a
            href={`/reviews${instance ? `?instance=${instance}` : ""}`}
            className="bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            Review Now →
          </a>
        </div>
      )}
    </div>
  );
}

export default function OverviewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading…</div>}>
      <OverviewContent />
    </Suspense>
  );
}
