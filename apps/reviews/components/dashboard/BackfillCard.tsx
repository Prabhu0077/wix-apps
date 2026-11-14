"use client";

// "Ask recent customers" (Free): one click sends review requests for orders
// fulfilled in the last 30 days, within the monthly plan limit. Useful right
// after install, when the store has past orders but no reviews yet.

import { useState } from "react";

import { api, ApiError } from "@/lib/dashboard-client";

type Result = {
  found: number;
  scheduled: number;
  alreadyAsked: number;
  unsubscribed: number;
  noEmail: number;
  overLimit: number;
  lookbackDays: number;
};

export function summary(r: Result): string {
  if (r.found === 0) return `No fulfilled orders in the last ${r.lookbackDays} days.`;
  const parts = [
    `${r.scheduled} review request${r.scheduled === 1 ? "" : "s"} will go out with the next daily send.`,
  ];
  if (r.alreadyAsked) parts.push(`${r.alreadyAsked} already asked.`);
  if (r.overLimit) parts.push(`${r.overLimit} left out because of this month's plan limit.`);
  if (r.unsubscribed) parts.push(`${r.unsubscribed} unsubscribed.`);
  if (r.noEmail) parts.push(`${r.noEmail} had no email or products.`);
  return parts.join(" ");
}

export function BackfillCard({ instance }: { instance: string | null }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      setResult(summary(await api<Result>(instance, "/api/requests/backfill", { method: "POST", body: {} })));
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="backfill-title">
      <div className="card-head">
        <div>
          <h2 className="card-title" id="backfill-title">
            Ask recent customers
          </h2>
          <p className="card-sub">
            Send a review request to customers whose orders were fulfilled in the last 30 days. Each order is asked
            once, and it counts towards your monthly requests.
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={run} disabled={busy || result !== null}>
          {busy ? "Finding orders…" : "Ask recent customers"}
        </button>
      </div>
      {(result || error) && (
        <div className="card-body">
          {result && (
            <p className="notice notice-ok" role="status">
              {result}
            </p>
          )}
          {error && (
            <p className="notice notice-error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
