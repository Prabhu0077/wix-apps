"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";

import { Stars } from "@/components/ui/Stars";
import { type Stats } from "@/components/dashboard/types";
import { BackfillCard } from "@/components/dashboard/BackfillCard";
import { HealthCard } from "@/components/dashboard/HealthCard";
import { UsageCard } from "@/components/dashboard/UsageCard";
import { api, ApiError, useInstance } from "@/lib/dashboard-client";

function Overview() {
  const instance = useInstance();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Stats>(instance, "/api/stats")
      .then(setStats)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Something went wrong."));
  }, [instance]);

  if (error) return <div className="notice notice-error">{error}</div>;
  if (!stats) return <div className="loading">Loading your reviews…</div>;

  const reviewsHref = `/reviews${instance ? `?instance=${encodeURIComponent(instance)}` : ""}`;
  const maxBar = Math.max(1, ...Object.values(stats.distribution));

  const steps = [
    {
      done: stats.requestsScheduled > 0,
      title: "Get your first order fulfilled",
      help: "When you mark an order as fulfilled, we schedule a review request for that customer.",
    },
    {
      done: stats.requestsSent > 0,
      title: "First review request sent",
      help: "Requests go out after the delay you choose in Settings (14 days by default).",
    },
    {
      done: stats.totalReviews > 0,
      title: "First review received",
      help: "New reviews wait for you in the Reviews tab.",
    },
    {
      done: stats.approvedReviews > 0,
      title: "First review published",
      help: "Published reviews show on your product pages once the reviews widget is added in the Editor.",
    },
  ];
  const allDone = steps.every((s) => s.done);

  return (
    <div className="stack">
      {stats.pendingReviews > 0 && (
        <div className="callout">
          <p>
            <strong>
              {stats.pendingReviews} new review{stats.pendingReviews === 1 ? " is" : "s are"} waiting for you.
            </strong>{" "}
            <span className="rsmall">Publish or hide them before they show on your store.</span>
          </p>
          <Link href={reviewsHref} className="btn btn-primary">
            Check reviews
          </Link>
        </div>
      )}

      {stats.storeAddressMissing && (
        <div className="notice notice-warn">
          <strong>Add your business address in Wix.</strong> Review request emails show your store&apos;s postal address,
          which email law in the US and other countries requires. Add it in your Wix dashboard under Settings › Business
          Info and this message goes away on its own.
        </div>
      )}

      {/* Near or at the limit: move the usage card up where it can't be missed. */}
      {stats.usage.level !== "ok" && <UsageCard stats={stats} />}

      <section className="card" aria-labelledby="rating-title">
        <div className="card-head">
          <div>
            <h2 className="card-title" id="rating-title">
              Store rating
            </h2>
            <p className="card-sub">From published reviews only.</p>
          </div>
        </div>
        <div className="card-body">
          {stats.approvedReviews === 0 ? (
            <div className="empty">
              <p className="empty-title">No published reviews yet</p>
              <p>Your rating appears here after you publish the first review.</p>
            </div>
          ) : (
            <div className="ledger">
              <div>
                <div className="ledger-avg">
                  {stats.avgRating.toFixed(1)}
                  <span className="ledger-of"> / 5</span>
                </div>
                <div style={{ marginTop: 8 }}>
                  <Stars rating={stats.avgRating} size={18} />
                </div>
                <p className="ledger-caption">
                  {stats.approvedReviews} published review{stats.approvedReviews === 1 ? "" : "s"}
                </p>
              </div>
              <div className="bars">
                {[5, 4, 3, 2, 1].map((star) => {
                  const n = stats.distribution[star] ?? 0;
                  return (
                    <div className="bar" key={star}>
                      <span>{star} star{star === 1 ? "" : "s"}</span>
                      <div className="bar-track" aria-hidden="true">
                        <div className="bar-fill" style={{ width: `${(n / maxBar) * 100}%` }} />
                      </div>
                      <span className="bar-n">{n}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="figures">
          <div className="figure">
            <div className="figure-n">{stats.requestsSent}</div>
            <div className="figure-label">Review requests sent</div>
          </div>
          <div className="figure">
            <div className="figure-n">{stats.totalReviews}</div>
            <div className="figure-label">Reviews received</div>
          </div>
          <div className="figure">
            <div className="figure-n">{stats.pendingReviews}</div>
            <div className="figure-label">Waiting for you</div>
          </div>
        </div>
      </section>

      <HealthCard instance={instance} />

      <BackfillCard instance={instance} />

      {stats.usage.level === "ok" && <UsageCard stats={stats} />}

      {!allDone && (
        <section className="card" aria-labelledby="setup-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="setup-title">
                Getting started
              </h2>
              <p className="card-sub">These steps complete on their own as your store gets orders.</p>
            </div>
          </div>
          <ul className="checklist">
            {steps.map((s) => (
              <li key={s.title} className={`check${s.done ? " check-done" : ""}`}>
                <span className="check-dot" aria-label={s.done ? "Done" : "Not done yet"} role="img" />
                <div>
                  <div className="check-title">{s.title}</div>
                  <div className="check-help">{s.help}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function OverviewPage() {
  return (
    <Suspense fallback={<div className="loading">Loading your reviews…</div>}>
      <Overview />
    </Suspense>
  );
}
