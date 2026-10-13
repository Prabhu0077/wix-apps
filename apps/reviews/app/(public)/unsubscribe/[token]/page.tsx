"use client";

// Unsubscribe page linked from the review request email footer.
// A button, not an automatic action on page load: link scanners in mail
// systems open links, and must not unsubscribe people by accident.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ask"; store: string }
  | { kind: "done"; store: string };

export default function UnsubscribePage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/public/unsubscribe/${token}`)
      .then((r) => r.json())
      .then((d: { storeName?: string | null; unsubscribed?: boolean; error?: string }) => {
        if (d.error) return setState({ kind: "error", message: "This unsubscribe link doesn't work. Check that you opened the full link from the email." });
        const store = d.storeName ?? "this store";
        setState(d.unsubscribed ? { kind: "done", store } : { kind: "ask", store });
      })
      .catch(() => setState({ kind: "error", message: "We couldn't load this page. Check your connection and try again." }));
  }, [token]);

  async function confirm() {
    if (state.kind !== "ask") return;
    setBusy(true);
    const res = await fetch(`/api/public/unsubscribe/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => null);
    if (res?.ok) setState({ kind: "done", store: state.store });
    else {
      setBusy(false);
      setState({ kind: "error", message: "That didn't work. Check your connection and try again." });
    }
  }

  return (
    <main className="rf">
      <h1 className="rf-title">
        {state.kind === "done" ? "You're unsubscribed" : "Stop review emails?"}
      </h1>
      <div className="rf-card">
        {state.kind === "loading" && <p className="rf-hint">Loading…</p>}
        {state.kind === "error" && <p>{state.message}</p>}
        {state.kind === "ask" && (
          <>
            <p>
              You&apos;ll stop getting emails from <strong>{state.store}</strong> asking you to review your orders. Other
              emails from the store, like order updates, aren&apos;t affected.
            </p>
            <button type="button" className="rf-submit" onClick={confirm} disabled={busy}>
              {busy ? "Saving…" : "Unsubscribe"}
            </button>
          </>
        )}
        {state.kind === "done" && (
          <p>
            <strong>{state.store}</strong> won&apos;t send you review requests again. If this was a mistake, contact the
            store.
          </p>
        )}
      </div>
    </main>
  );
}
