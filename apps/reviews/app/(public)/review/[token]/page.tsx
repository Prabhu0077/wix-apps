"use client";

// Shopper-facing review form, opened from the review request email.
// It belongs to the merchant's store: store name first, neutral styling, no
// app branding beyond the footer line. No login — the token is the proof.
//
// Photo upload stays off until Cloudflare R2 is active (task T2.4).

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { REVIEW_LINK_DAYS } from "@/lib/product";

type Product = { id: string; name: string; imageUrl?: string };
type Context = { storeName: string | null; products: Product[] };

const LOAD_ERRORS: Record<string, string> = {
  not_found: "This review link doesn't work. Check that you opened the full link from the email.",
  expired: `This review link has expired. Links work for ${REVIEW_LINK_DAYS} days after the email is sent.`,
  already_submitted: "You've already sent a review for this order. Thank you.",
};

const RATING_WORDS = ["", "Poor", "Fair", "Okay", "Good", "Excellent"];
const STAR_PATH =
  "M10 1.6l2.47 5.3 5.8.68-4.29 3.96 1.13 5.73L10 14.4l-5.11 2.87 1.13-5.73L1.73 7.58l5.8-.68z";

export default function ReviewFormPage() {
  const { token } = useParams<{ token: string }>();
  const [ctx, setCtx] = useState<Context | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/public/review/${token}`)
      .then((r) => r.json())
      .then((d: Context & { error?: string }) => {
        if (d.error) setLoadError(LOAD_ERRORS[d.error] ?? "We couldn't open this review form. Try the link again later.");
        else setCtx(d);
      })
      .catch(() => setLoadError("We couldn't open this review form. Check your connection and try again."));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) return setError("Choose a star rating.");
    if (!name.trim()) return setError("Add the name you'd like shown with your review.");
    if (body.trim().length < 10) return setError("Write at least a sentence (10 characters or more).");

    setSending(true);
    setError(null);
    const res = await fetch(`/api/public/review/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, body: body.trim(), customerName: name.trim(), mediaKeys: [] }),
    }).catch(() => null);

    if (res?.ok) {
      setSent(true);
    } else {
      setError("Your review didn't send. Check your connection and try again.");
      setSending(false);
    }
  }

  const store = ctx?.storeName ?? "the store";
  const shown = hover || rating;

  return (
    <main className="rf">
      {ctx && <p className="rf-store">{store}</p>}
      <h1 className="rf-title">{sent ? "Thanks for your review" : "How was your order?"}</h1>

      <div className="rf-card">
        {loadError ? (
          <p>{loadError}</p>
        ) : !ctx ? (
          <p className="rf-hint">Loading…</p>
        ) : sent ? (
          <div className="rf-done">
            <h2>Your review has been sent to {store}.</h2>
            <p className="rf-hint">It will appear on the product page once the store publishes it.</p>
          </div>
        ) : (
          <form onSubmit={submit} noValidate style={{ display: "grid", gap: 22 }}>
            {ctx.products.map((p) => (
              <div className="rf-product" key={p.id}>
                {p.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="" />
                )}
                <span className="rf-product-name">{p.name}</span>
              </div>
            ))}

            <fieldset className="rf-field" style={{ border: "none", padding: 0, margin: 0 }}>
              <legend className="rf-label">Your rating</legend>
              <div className="rate" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n}>
                    <input
                      type="radio"
                      id={`star-${n}`}
                      name="rating"
                      value={n}
                      checked={rating === n}
                      onChange={() => setRating(n)}
                    />
                    <label htmlFor={`star-${n}`} onMouseEnter={() => setHover(n)} aria-label={`${n} star${n > 1 ? "s" : ""}, ${RATING_WORDS[n]}`}>
                      <svg viewBox="0 0 20 20" aria-hidden="true">
                        <path d={STAR_PATH} className={n <= shown ? "star-on" : "star-off"} />
                      </svg>
                    </label>
                  </span>
                ))}
              </div>
              <p className="rate-word" aria-live="polite">
                {RATING_WORDS[shown]}
              </p>
            </fieldset>

            <div className="rf-field">
              <label className="rf-label" htmlFor="review">
                Your review
              </label>
              <textarea
                id="review"
                className="rf-textarea"
                maxLength={5000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="What did you like or dislike? How are you using it?"
              />
            </div>

            <div className="rf-field">
              <label className="rf-label" htmlFor="name">
                Name shown with your review
              </label>
              <input
                id="name"
                className="rf-input"
                maxLength={120}
                autoComplete="given-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Priya S."
              />
              <p className="rf-hint">Your email address is never shown.</p>
            </div>

            {error && (
              <p className="rf-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="rf-submit" disabled={sending}>
              {sending ? "Sending…" : "Send review"}
            </button>
          </form>
        )}
      </div>

      <p className="rf-note">
        Your review goes to {store}. The store may reply publicly. <a href="/privacy">Privacy</a>
      </p>
    </main>
  );
}
