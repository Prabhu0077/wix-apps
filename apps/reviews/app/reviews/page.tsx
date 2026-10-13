"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

type MediaItem = {
  kind: "PHOTO" | "VIDEO";
  publicUrl: string;
  thumbUrl: string | null;
};

type Review = {
  id: string;
  customerName: string;
  customerEmail: string;
  productId: string;
  rating: number;
  body: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN";
  moderationFlags: string[];
  reply: string | null;
  createdAt: string;
  publishedAt: string | null;
  media: MediaItem[];
};

const STATUS_TABS = ["PENDING", "APPROVED", "REJECTED", "ALL"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

const STATUS_COLORS: Record<string, string> = {
  PENDING:  "bg-amber-500/15 text-amber-400 border-amber-500/30",
  APPROVED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  REJECTED: "bg-red-500/15 text-red-400 border-red-500/30",
  HIDDEN:   "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 20 20" className={`w-3.5 h-3.5 ${n <= rating ? "text-amber-400" : "text-slate-600"}`} fill="currentColor">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.956a1 1 0 00.95.69h4.162c.969 0 1.372 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.197-1.54-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.062 9.383c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69L9.049 2.927z" />
        </svg>
      ))}
    </div>
  );
}

function ModerationContent() {
  const searchParams = useSearchParams();
  const instance = searchParams.get("instance");

  const [activeTab, setActiveTab] = useState<StatusTab>("PENDING");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [expandedReply, setExpandedReply] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    if (!instance) {
      setError("No instance.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/reviews?instance=${encodeURIComponent(instance)}&status=${activeTab}`
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setReviews(data.reviews ?? []);
    } catch {
      setError("Failed to load reviews.");
    } finally {
      setLoading(false);
    }
  }, [instance, activeTab]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  async function doAction(reviewId: string, action: "approve" | "reject" | "hide", reply?: string) {
    if (!instance) return;
    setActionLoading(reviewId);
    try {
      const res = await fetch(`/api/reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instance, action, ...(reply ? { reply } : {}) }),
      });
      if (!res.ok) throw new Error("Action failed");
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      setExpandedReply(null);
    } catch {
      alert("Action failed. Please try again.");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Moderation</h1>
        <p className="text-slate-400 text-sm mt-0.5">Approve or reject customer reviews before they go live</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-800 rounded-lg p-1 w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === tab ? "bg-slate-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-slate-400 text-sm py-12 text-center">Loading…</div>
      ) : error ? (
        <div className="text-red-400 text-sm py-12 text-center">{error}</div>
      ) : reviews.length === 0 ? (
        <div className="text-slate-500 text-sm py-16 text-center">
          No {activeTab.toLowerCase()} reviews.
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-medium text-sm">{r.customerName}</span>
                    <span className="text-slate-500 text-xs">{r.customerEmail}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wide ${STATUS_COLORS[r.status]}`}>
                      {r.status}
                    </span>
                  </div>
                  <StarRow rating={r.rating} />
                </div>
                <span className="text-slate-500 text-xs shrink-0">
                  {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>

              <p className="text-slate-300 text-sm leading-relaxed">{r.body}</p>

              {r.moderationFlags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {r.moderationFlags.map((f) => (
                    <span key={f} className="text-[10px] bg-red-900/40 text-red-400 border border-red-800 rounded px-2 py-0.5">
                      {f}
                    </span>
                  ))}
                </div>
              )}

              {r.media.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {r.media.map((m, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={m.thumbUrl ?? m.publicUrl}
                      alt={`review media ${i + 1}`}
                      className="w-16 h-16 object-cover rounded-lg border border-slate-700"
                    />
                  ))}
                </div>
              )}

              {r.reply && (
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm">
                  <p className="text-slate-400 text-xs mb-1 font-medium">Your Reply</p>
                  <p className="text-slate-300">{r.reply}</p>
                </div>
              )}

              {expandedReply === r.id && (
                <textarea
                  rows={3}
                  placeholder="Write a reply…"
                  value={replyDraft[r.id] ?? ""}
                  onChange={(e) => setReplyDraft((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500 resize-none"
                />
              )}

              <div className="flex gap-2 flex-wrap pt-1">
                {r.status !== "APPROVED" && (
                  <button
                    onClick={() => doAction(r.id, "approve", replyDraft[r.id])}
                    disabled={actionLoading === r.id}
                    className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-medium px-4 py-1.5 rounded-lg transition-colors"
                  >
                    {actionLoading === r.id ? "…" : "✓ Approve"}
                  </button>
                )}
                {r.status !== "REJECTED" && (
                  <button
                    onClick={() => doAction(r.id, "reject")}
                    disabled={actionLoading === r.id}
                    className="bg-red-900 hover:bg-red-800 disabled:opacity-50 text-red-300 text-xs font-medium px-4 py-1.5 rounded-lg transition-colors"
                  >
                    {actionLoading === r.id ? "…" : "✕ Reject"}
                  </button>
                )}
                {r.status === "APPROVED" && (
                  <button
                    onClick={() => doAction(r.id, "hide")}
                    disabled={actionLoading === r.id}
                    className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 text-xs font-medium px-4 py-1.5 rounded-lg transition-colors"
                  >
                    Hide
                  </button>
                )}
                <button
                  onClick={() => setExpandedReply(expandedReply === r.id ? null : r.id)}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium px-4 py-1.5 rounded-lg transition-colors"
                >
                  {expandedReply === r.id ? "Cancel" : "Reply"}
                </button>
                {expandedReply === r.id && replyDraft[r.id]?.trim() && (
                  <button
                    onClick={() => doAction(r.id, "approve", replyDraft[r.id])}
                    disabled={actionLoading === r.id}
                    className="bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white text-xs font-medium px-4 py-1.5 rounded-lg transition-colors"
                  >
                    Approve + Reply
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ModerationPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading…</div>}>
      <ModerationContent />
    </Suspense>
  );
}
