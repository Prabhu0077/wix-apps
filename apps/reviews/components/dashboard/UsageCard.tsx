// This month's review-request usage, with a warning from 80% of the limit
// and a clear "limit reached" state. Used on Overview and Plan.

import { PLAN_LABEL, type Stats } from "@/components/dashboard/types";

function resetDay(iso: string): string {
  // resetsAt is midnight UTC on the 1st; format in UTC so it never shows the 31st.
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}

export function UsageCard({ stats }: { stats: Stats }) {
  const { used, limit, skipped, level, resetsAt } = stats.usage;
  const share = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const resets = resetDay(resetsAt);
  const canUpgrade = stats.plan !== "GROWTH";

  return (
    <section className="card" aria-labelledby="usage-title">
      <div className="card-head">
        <div>
          <h2 className="card-title" id="usage-title">
            Review requests this month
          </h2>
          <p className="card-sub">
            {PLAN_LABEL[stats.plan] ?? stats.plan} plan. Counts each fulfilled order we ask for a review. Resets on{" "}
            {resets}.
          </p>
        </div>
      </div>
      <div className="card-body stack-sm">
        <div className="meter-row">
          <span className="meter-n">
            {used.toLocaleString("en-US")} <span className="rsmall">of {limit.toLocaleString("en-US")} used</span>
          </span>
          <span className="rsmall">{share}%</span>
        </div>
        <div
          className="meter"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={Math.min(used, limit)}
          aria-label="Review requests used this month"
        >
          <div className={`meter-fill meter-${level}`} style={{ width: `${share}%` }} />
        </div>

        {level === "warning" && (
          <div className="notice notice-warn notice-row">
            <span>
              You&apos;ve used {share}% of this month&apos;s requests. After {limit.toLocaleString("en-US")}, new orders
              won&apos;t get a review request until {resets}.
            </span>
            {canUpgrade && (
              <a className="btn btn-secondary btn-sm" href={stats.upgradeUrl} target="_top">
                See plans
              </a>
            )}
          </div>
        )}

        {level === "reached" && (
          <div className="notice notice-error notice-row">
            <span>
              <strong>You&apos;ve reached this month&apos;s limit.</strong>{" "}
              {skipped > 0
                ? `${skipped.toLocaleString("en-US")} customer${skipped === 1 ? " wasn't" : "s weren't"} asked for a review. `
                : "New orders won't be asked for a review. "}
              Requests start again on {resets}
              {canUpgrade ? ", or right away if you upgrade." : ". Contact support if you need more."} Your published
              reviews stay on your store.
            </span>
            {canUpgrade && (
              <a className="btn btn-primary btn-sm" href={stats.upgradeUrl} target="_top">
                Upgrade
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
