"use client";

// "Is everything working?" card on Overview (PRD R10). Problems first, so a
// merchant sees what needs fixing without reading the green rows.

import { useEffect, useState } from "react";

import { api, ApiError } from "@/lib/dashboard-client";

type Check = { key: string; status: "ok" | "warn" | "error"; title: string; detail: string };

const ORDER = { error: 0, warn: 1, ok: 2 } as const;
const LABEL = { ok: "Working", warn: "Needs attention", error: "Problem" } as const;

export function HealthCard({ instance }: { instance: string | null }) {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ checks: Check[] }>(instance, "/api/health")
      .then((d) => setChecks([...d.checks].sort((a, b) => ORDER[a.status] - ORDER[b.status])))
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Couldn't run the checks."));
  }, [instance]);

  const problems = checks?.filter((c) => c.status !== "ok").length ?? 0;

  return (
    <section className="card" aria-labelledby="health-title">
      <div className="card-head">
        <div>
          <h2 className="card-title" id="health-title">
            Setup check
          </h2>
          <p className="card-sub">
            {checks === null
              ? "Checking your setup…"
              : problems === 0
                ? "Everything is working."
                : `${problems} thing${problems === 1 ? " needs" : "s need"} your attention.`}
          </p>
        </div>
      </div>
      {error && <div className="card-body notice notice-error">{error}</div>}
      {checks && (
        <ul className="health">
          {checks.map((c) => (
            <li key={c.key} className={`health-item health-${c.status}`}>
              <span className="health-dot" role="img" aria-label={LABEL[c.status]} />
              <div>
                <div className="check-title">{c.title}</div>
                <div className="check-help">{c.detail}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
