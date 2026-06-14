"use client";

// Storefront widget — embedded as an iframe on Wix product pages.
// URL: /widget?instanceId=<id>&productId=<id>
//
// Wix loads this page inside a sandboxed iframe. It must:
//  1. Be lightweight (no heavy deps)
//  2. Have no navigation / sidebar (AppShell excluded via layout)
//  3. Fit in a narrow column (min-width: 300px)
//  4. Allow cross-origin embedding (CSP frame-ancestors already set in next.config.ts)

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

type MediaItem = { kind: string; url: string; thumbUrl: string };

type Review = {
  id: string;
  customerName: string;
  rating: number;
  body: string;
  reply: string | null;
  publishedAt: string;
  media: MediaItem[];
};

type WidgetData = {
  reviews: Review[];
  summary: {
    total: number;
    average: number;
    distribution: Record<string, number>;
  };
};

// ── Stars ─────────────────────────────────────────────────────────────────────

function StarFull({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="#f59e0b">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.956a1 1 0 00.95.69h4.162c.969 0 1.372 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.197-1.54-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.062 9.383c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69L9.049 2.927z" />
    </svg>
  );
}

function StarEmpty({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="#d1d5db">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.956a1 1 0 00.95.69h4.162c.969 0 1.372 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.197-1.54-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.062 9.383c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69L9.049 2.927z" />
    </svg>
  );
}

function StarRow({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) =>
        n <= Math.round(rating) ? (
          <StarFull key={n} size={size} />
        ) : (
          <StarEmpty key={n} size={size} />
        )
      )}
    </span>
  );
}

// ── Rating bar ────────────────────────────────────────────────────────────────

function RatingBar({ star, count, total }: { star: number; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#6b7280" }}>
      <span style={{ width: 24, textAlign: "right" }}>{star}★</span>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#f3f4f6", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "#f59e0b", borderRadius: 3 }} />
      </div>
      <span style={{ width: 28 }}>{count}</span>
    </div>
  );
}

// ── Review card ───────────────────────────────────────────────────────────────

function ReviewCard({ review }: { review: Review }) {
  const [expanded, setExpanded] = useState(false);
  const maxLen = 220;
  const needsTruncation = review.body.length > maxLen;
  const displayBody = !needsTruncation || expanded ? review.body : review.body.slice(0, maxLen) + "…";

  const date = new Date(review.publishedAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: "16px 18px",
        background: "#fff",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>
            {review.customerName}
          </div>
          <StarRow rating={review.rating} size={13} />
        </div>
        <span style={{ fontSize: 12, color: "#9ca3af" }}>{date}</span>
      </div>

      {/* Body */}
      <p style={{ margin: "8px 0 0", fontSize: 14, color: "#374151", lineHeight: 1.6 }}>
        {displayBody}
        {needsTruncation && (
          <button
            onClick={() => setExpanded((e) => !e)}
            style={{
              marginLeft: 6,
              fontSize: 12,
              color: "#6366f1",
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        )}
      </p>

      {/* Photos */}
      {review.media.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          {review.media.map((m, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={m.thumbUrl ?? m.url}
              alt=""
              style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: "1px solid #e5e7eb" }}
            />
          ))}
        </div>
      )}

      {/* Merchant reply */}
      {review.reply && (
        <div
          style={{
            marginTop: 12,
            background: "#f9fafb",
            borderLeft: "3px solid #e5e7eb",
            padding: "8px 12px",
            borderRadius: "0 8px 8px 0",
          }}
        >
          <p style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", margin: "0 0 4px" }}>
            Store response
          </p>
          <p style={{ fontSize: 13, color: "#374151", margin: 0, lineHeight: 1.5 }}>
            {review.reply}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────

function WidgetContent() {
  const searchParams = useSearchParams();
  const instanceId = searchParams.get("instanceId");
  const productId = searchParams.get("productId");

  const [data, setData] = useState<WidgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"newest" | "highest" | "lowest">("newest");

  const fetchData = useCallback(async () => {
    if (!instanceId || !productId) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/widget/products/${encodeURIComponent(productId)}?instanceId=${encodeURIComponent(instanceId)}`
      );
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [instanceId, productId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
        Loading reviews…
      </div>
    );
  }

  if (!data || data.summary.total === 0) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
        No reviews yet. Be the first to review this product!
      </div>
    );
  }

  const { reviews, summary } = data;

  const sorted = [...reviews].sort((a, b) => {
    if (sortBy === "highest") return b.rating - a.rating;
    if (sortBy === "lowest") return a.rating - b.rating;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", maxWidth: 720, margin: "0 auto", padding: "0 0 32px" }}>
      {/* Summary bar */}
      <div
        style={{
          display: "flex",
          gap: 32,
          alignItems: "flex-start",
          padding: "20px 0 24px",
          borderBottom: "1px solid #e5e7eb",
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        {/* Big number */}
        <div style={{ textAlign: "center", minWidth: 80 }}>
          <div style={{ fontSize: 48, fontWeight: 700, color: "#111827", lineHeight: 1 }}>
            {summary.average.toFixed(1)}
          </div>
          <StarRow rating={summary.average} size={18} />
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
            {summary.total} review{summary.total !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Distribution bars */}
        <div style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 5, paddingTop: 6 }}>
          {[5, 4, 3, 2, 1].map((star) => (
            <RatingBar
              key={star}
              star={star}
              count={summary.distribution[star] ?? 0}
              total={summary.total}
            />
          ))}
        </div>
      </div>

      {/* Sort control */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          style={{
            fontSize: 13,
            color: "#374151",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: "6px 10px",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          <option value="newest">Newest first</option>
          <option value="highest">Highest rated</option>
          <option value="lowest">Lowest rated</option>
        </select>
      </div>

      {/* Review list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {sorted.map((r) => (
          <ReviewCard key={r.id} review={r} />
        ))}
      </div>

      {/* Powered-by footer */}
      <div style={{ textAlign: "center", marginTop: 24, fontSize: 11, color: "#d1d5db" }}>
        Powered by Visual UGC Reviews
      </div>
    </div>
  );
}

export default function WidgetPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 24, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
          Loading…
        </div>
      }
    >
      <WidgetContent />
    </Suspense>
  );
}
