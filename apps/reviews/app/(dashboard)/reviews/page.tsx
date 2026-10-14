"use client";

import { Suspense, useCallback, useEffect, useState } from "react";

import { ImportPanel } from "@/components/dashboard/ImportPanel";
import { Stars } from "@/components/ui/Stars";
import { api, ApiError, useInstance } from "@/lib/dashboard-client";
import { fullDate, reviewDateLabel } from "@/lib/dates";
import { SPAM_FLAG_LABEL } from "@/lib/spam";

type Media = { kind: "PHOTO" | "VIDEO"; publicUrl: string; thumbUrl: string | null };
type Status = "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN";
type Review = {
  id: string;
  customerName: string;
  customerEmail: string;
  rating: number;
  body: string;
  status: Status;
  verified?: boolean;
  source?: "REQUEST" | "IMPORT" | "MANUAL";
  incentivized?: boolean;
  moderationFlags?: string[];
  helpfulCount?: number;
  reply: string | null;
  createdAt: string;
  media: Media[];
};
type Action = "approve" | "reject" | "hide" | "reply";

const FILTERS: { key: Status | "ALL"; label: string }[] = [
  { key: "PENDING", label: "Waiting for you" },
  { key: "APPROVED", label: "Published" },
  { key: "HIDDEN", label: "Hidden" },
  { key: "REJECTED", label: "Not published" },
  { key: "ALL", label: "All" },
];

const STATUS_BADGE: Record<Status, { cls: string; text: string }> = {
  PENDING: { cls: "badge-pending", text: "Waiting" },
  APPROVED: { cls: "badge-approved", text: "Published" },
  HIDDEN: { cls: "badge-hidden", text: "Hidden" },
  REJECTED: { cls: "badge-rejected", text: "Not published" },
};

const EMPTY_TEXT: Record<Status | "ALL", { title: string; text: string }> = {
  PENDING: { title: "You're all caught up", text: "New reviews land here first, so you can check them before they go live." },
  APPROVED: { title: "No published reviews yet", text: "Reviews you publish show on your product pages." },
  HIDDEN: { title: "No hidden reviews", text: "Hide a published review to take it off your store without deleting it." },
  REJECTED: { title: "Nothing here", text: "Reviews you choose not to publish are kept here." },
  ALL: { title: "No reviews yet", text: "Reviews arrive after customers get their review request email." },
};

function ReviewItem({
  review,
  busy,
  onAction,
}: {
  review: Review;
  busy: boolean;
  onAction: (id: string, action: Action, reply?: string) => Promise<boolean>;
}) {
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState(review.reply ?? "");
  const badge = STATUS_BADGE[review.status];

  return (
    <li className="ritem">
      <div className="rmeta">
        <span className="rname">{review.customerName}</span>
        <Stars rating={review.rating} size={14} />
        <span className={`badge ${badge.cls}`}>{badge.text}</span>
        {review.verified && <span className="badge badge-verified">Verified buyer</span>}
        {review.source === "IMPORT" && <span className="badge badge-hidden">Imported</span>}
        {review.incentivized && <span className="badge badge-hidden">Incentive</span>}
        <time className="rsmall rdate" dateTime={review.createdAt} title={`Written ${fullDate(review.createdAt)}`}>
          {reviewDateLabel(review.createdAt)}
        </time>
      </div>
      <p className="rsmall">{review.customerEmail}</p>
      {(review.moderationFlags?.length ?? 0) > 0 && (
        <p className="rflags">
          <span className="badge badge-rejected">Check this</span>{" "}
          {review.moderationFlags!.map((f) => SPAM_FLAG_LABEL[f as keyof typeof SPAM_FLAG_LABEL] ?? f).join(" · ")}
        </p>
      )}
      <p className="rbody">{review.body}</p>
      {(review.helpfulCount ?? 0) > 0 && (
        <p className="rsmall">
          {review.helpfulCount} shopper{review.helpfulCount === 1 ? "" : "s"} found this helpful
        </p>
      )}

      {review.media.length > 0 && (
        <div className="rmedia">
          {review.media.map((m, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={m.thumbUrl ?? m.publicUrl} alt={`Photo ${i + 1} from ${review.customerName}`} />
          ))}
        </div>
      )}

      {review.reply && !replying && (
        <div className="rreply">
          <p className="rreply-label">Your reply</p>
          <p>{review.reply}</p>
        </div>
      )}

      {replying && (
        <div className="field">
          <label className="label" htmlFor={`reply-${review.id}`}>
            Your public reply
          </label>
          <textarea
            id={`reply-${review.id}`}
            className="textarea"
            maxLength={1000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <p className="help">Your reply shows under the review on your store.</p>
        </div>
      )}

      <div className="ractions">
        {replying ? (
          <>
            <button
              className="btn btn-primary btn-sm"
              disabled={busy || !draft.trim()}
              onClick={async () => {
                if (await onAction(review.id, "reply", draft.trim())) setReplying(false);
              }}
            >
              Save reply
            </button>
            <button className="btn btn-text btn-sm" onClick={() => setReplying(false)}>
              Cancel
            </button>
          </>
        ) : (
          <>
            {review.status !== "APPROVED" && (
              <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => onAction(review.id, "approve")}>
                Publish
              </button>
            )}
            {review.status === "APPROVED" && (
              <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => onAction(review.id, "hide")}>
                Hide from store
              </button>
            )}
            {review.status === "PENDING" && (
              <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => onAction(review.id, "reject")}>
                Don&apos;t publish
              </button>
            )}
            <button className="btn btn-text btn-sm" disabled={busy} onClick={() => setReplying(true)}>
              {review.reply ? "Edit reply" : "Reply"}
            </button>
          </>
        )}
      </div>
    </li>
  );
}

function Reviews() {
  const instance = useInstance();
  const [filter, setFilter] = useState<Status | "ALL">("PENDING");
  const [rating, setRating] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const query = useCallback(
    (p: number) => `/api/reviews?status=${filter}&page=${p}${rating ? `&rating=${rating}` : ""}`,
    [filter, rating],
  );

  const load = useCallback(() => {
    setReviews(null);
    setError(null);
    setPage(0);
    api<{ reviews: Review[]; hasMore: boolean }>(instance, query(0))
      .then((d) => {
        setReviews(d.reviews);
        setHasMore(d.hasMore);
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Something went wrong."));
  }, [instance, query]);

  useEffect(load, [load]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const d = await api<{ reviews: Review[]; hasMore: boolean }>(instance, query(page + 1));
      setReviews((prev) => {
        const seen = new Set((prev ?? []).map((r) => r.id));
        return [...(prev ?? []), ...d.reviews.filter((r) => !seen.has(r.id))];
      });
      setHasMore(d.hasMore);
      setPage((p) => p + 1);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Couldn't load more reviews.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function onAction(id: string, action: Action, reply?: string): Promise<boolean> {
    setBusyId(id);
    setNotice(null);
    try {
      const res = await api<{ status: Status; reply: string | null }>(instance, `/api/reviews/${id}`, {
        method: "PATCH",
        body: { action, ...(reply !== undefined ? { reply } : {}) },
      });
      setReviews((prev) =>
        (prev ?? [])
          .map((r) => (r.id === id ? { ...r, status: res.status, reply: res.reply } : r))
          .filter((r) => filter === "ALL" || r.status === filter),
      );
      setNotice(
        { approve: "Review published.", hide: "Review hidden from your store.", reject: "Review won't be published.", reply: "Reply saved." }[action],
      );
      return true;
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "That didn't work. Try again.");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="stack">
      <div className="toolbar">
        <div className="filters" role="group" aria-label="Show reviews">
          {FILTERS.map((f) => (
            <button key={f.key} className="chip" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
          <label className="visually-hidden" htmlFor="rating-filter">
            Star rating
          </label>
          <select
            id="rating-filter"
            className="select-sm"
            value={rating ?? ""}
            onChange={(e) => setRating(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">All ratings</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} star{n === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </div>
        {/* Every plan, every review, any time (PRD R9). A plain link so the
            browser handles the download inside the Wix dashboard iframe. */}
        <div className="toolbar-actions">
          <button className="btn btn-secondary btn-sm" aria-expanded={showImport} onClick={() => setShowImport((v) => !v)}>
            Import reviews
          </button>
          {instance && (
            <a
              className="btn btn-secondary btn-sm"
              href={`/api/reviews/export?instance=${encodeURIComponent(instance)}`}
              download
            >
              Export all reviews (CSV)
            </a>
          )}
        </div>
      </div>

      {showImport && <ImportPanel instance={instance} onDone={load} />}

      {notice && (
        <div className="notice notice-ok" role="status">
          {notice}
        </div>
      )}
      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}

      <section className="card" aria-label="Reviews">
        {reviews === null && !error ? (
          <div className="loading">Loading reviews…</div>
        ) : reviews && reviews.length === 0 ? (
          <div className="empty">
            {rating ? (
              <>
                <p className="empty-title">
                  No {rating}-star reviews here
                </p>
                <p>Try another rating or choose &quot;All ratings&quot;.</p>
              </>
            ) : (
              <>
                <p className="empty-title">{EMPTY_TEXT[filter].title}</p>
                <p>{EMPTY_TEXT[filter].text}</p>
              </>
            )}
          </div>
        ) : (
          <ul className="rlist">
            {(reviews ?? []).map((r) => (
              <ReviewItem key={r.id} review={r} busy={busyId === r.id} onAction={onAction} />
            ))}
          </ul>
        )}
        {hasMore && reviews && reviews.length > 0 && (
          <div className="card-foot">
            <button className="btn btn-secondary btn-sm" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? "Loading…" : "Show more reviews"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

export default function ReviewsPage() {
  return (
    <Suspense fallback={<div className="loading">Loading reviews…</div>}>
      <Reviews />
    </Suspense>
  );
}
