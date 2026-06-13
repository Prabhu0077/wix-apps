"use client";

// Public review submission page. No auth required — token proves legitimacy.
// Customers land here from the email link.
//
// MEDIA UPLOAD: disabled for v1 (R2 not yet configured).
// To re-enable: uncomment the MEDIA UPLOAD sections below and set R2 env vars.

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface Product {
  id: string;
  name: string;
  imageUrl?: string;
}

interface ReviewContext {
  token: string;
  customerEmail: string;
  products: Product[];
  status: string;
}

export default function ReviewPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [ctx, setCtx] = useState<ReviewContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [customerName, setCustomerName] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/public/review/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error === "not_found") setLoadError("This review link is invalid.");
        else if (data.error === "expired") setLoadError("This review link has expired (links are valid for 30 days).");
        else if (data.error === "already_submitted") setLoadError("You've already submitted a review for this order. Thank you!");
        else setCtx(data);
      })
      .catch(() => setLoadError("Failed to load review details. Please try again."));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) { setSubmitError("Please select a star rating."); return; }
    if (body.trim().length < 10) { setSubmitError("Please write at least 10 characters."); return; }
    if (!customerName.trim()) { setSubmitError("Please enter your name."); return; }

    setSubmitting(true);
    setSubmitError(null);

    const res = await fetch(`/api/public/review/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, body, customerName, mediaKeys: [] }),
    });

    if (res.ok) {
      setSubmitted(true);
    } else {
      const data = await res.json().catch(() => ({}));
      setSubmitError(data.detail ?? "Submission failed. Please try again.");
      setSubmitting(false);
    }
  }

  // ── Render states ──────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <p style={styles.errorMsg}>{loadError}</p>
        </div>
      </div>
    );
  }

  if (!ctx) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <p style={{ textAlign: "center", color: "#888" }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 56 }}>🎉</div>
            <h2 style={{ margin: "16px 0 8px" }}>Thank you for your review!</h2>
            <p style={{ color: "#666" }}>
              Your feedback helps other shoppers and means a lot to us.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const displayRating = hoverRating || rating;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.heading}>Share Your Review</h1>

        {ctx.products.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 14, color: "#888", marginBottom: 8 }}>Reviewing:</p>
            {ctx.products.map((p) => (
              <div key={p.id} style={styles.productRow}>
                {p.imageUrl && (
                  <img src={p.imageUrl} alt={p.name} style={styles.productImg} />
                )}
                <span style={{ fontSize: 15 }}>{p.name}</span>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Star rating */}
          <div style={{ marginBottom: 24 }}>
            <label style={styles.label}>Your Rating *</label>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 36,
                    color: star <= displayRating ? "#f59e0b" : "#d1d5db",
                    padding: 0,
                    lineHeight: 1,
                    transition: "color 0.1s",
                  }}
                  aria-label={`${star} star${star > 1 ? "s" : ""}`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div style={{ marginBottom: 16 }}>
            <label style={styles.label} htmlFor="customerName">Your Name *</label>
            <input
              id="customerName"
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Jane D."
              style={styles.input}
              maxLength={120}
              required
            />
          </div>

          {/* Review body */}
          <div style={{ marginBottom: 24 }}>
            <label style={styles.label} htmlFor="reviewBody">Your Review *</label>
            <textarea
              id="reviewBody"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Tell us about your experience with this product…"
              style={{ ...styles.input, minHeight: 120, resize: "vertical" }}
              maxLength={5000}
              required
            />
            <p style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>
              {body.length}/5000 — minimum 10 characters
            </p>
          </div>

          {/* MEDIA UPLOAD — disabled for v1. To re-enable:
              1. Activate Cloudflare R2 billing
              2. Run scratch/create_cf_resources.py and fill R2 vars in .env.local
              3. Uncomment the upload UI and the UploadFile logic above
          */}

          {submitError && <p style={styles.errorMsg}>{submitError}</p>}

          <button
            type="submit"
            disabled={submitting}
            style={{
              ...styles.submitBtn,
              opacity: submitting ? 0.6 : 1,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Submitting…" : "Submit Review"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "flex-start" as const,
    justifyContent: "center" as const,
    backgroundColor: "#f9f9f9",
    padding: "40px 16px",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
    padding: "40px 36px",
    width: "100%",
    maxWidth: 520,
  },
  heading: {
    fontSize: 24,
    fontWeight: 700,
    marginTop: 0,
    marginBottom: 24,
    color: "#111",
  },
  label: {
    display: "block",
    fontSize: 14,
    fontWeight: 600,
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 15,
    boxSizing: "border-box" as const,
    outline: "none",
  },
  productRow: {
    display: "flex",
    alignItems: "center" as const,
    gap: 12,
    padding: "8px 0",
    borderBottom: "1px solid #f3f4f6",
  },
  productImg: {
    width: 48,
    height: 48,
    objectFit: "cover" as const,
    borderRadius: 6,
    border: "1px solid #e5e7eb",
  },
  submitBtn: {
    width: "100%",
    padding: "14px",
    backgroundColor: "#4f46e5",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: "0.02em",
  },
  errorMsg: {
    color: "#ef4444",
    fontSize: 14,
    marginBottom: 16,
    padding: "10px 14px",
    backgroundColor: "#fef2f2",
    borderRadius: 6,
    border: "1px solid #fecaca",
  },
};
