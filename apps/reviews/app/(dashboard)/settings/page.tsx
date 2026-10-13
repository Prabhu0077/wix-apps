"use client";

import { Suspense, useEffect, useState } from "react";

import { PolicyCard } from "@/components/dashboard/PolicyCard";
import { Stars } from "@/components/ui/Stars";
import { api, ApiError, useInstance } from "@/lib/dashboard-client";
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/settings";

function Toggle({ id, checked, onChange }: { id: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      className="toggle"
      onClick={() => onChange(!checked)}
    />
  );
}

function Settings() {
  const instance = useInstance();
  const [s, setS] = useState<AppSettings | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    api<{ settings: AppSettings; storeName: string | null }>(instance, "/api/settings")
      .then((d) => {
        setS(d.settings);
        setStoreName(d.storeName);
      })
      .catch((e: unknown) => setNotice({ kind: "error", text: e instanceof ApiError ? e.message : "Couldn't load settings." }));
  }, [instance]);

  function set<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setS((prev) => ({ ...(prev ?? DEFAULT_SETTINGS), [key]: value }));
    setNotice(null);
  }

  async function save() {
    if (!s) return;
    setSaving(true);
    try {
      const d = await api<{ settings: AppSettings }>(instance, "/api/settings", { method: "POST", body: { settings: s } });
      setS(d.settings);
      setNotice({ kind: "ok", text: "Settings saved." });
    } catch (e: unknown) {
      setNotice({ kind: "error", text: e instanceof ApiError ? e.message : "Couldn't save settings. Try again." });
    } finally {
      setSaving(false);
    }
  }

  if (!s) {
    return notice ? <div className="notice notice-error">{notice.text}</div> : <div className="loading">Loading settings…</div>;
  }

  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <section className="card" aria-labelledby="email-title">
        <div className="card-head">
          <div>
            <h2 className="card-title" id="email-title">
              Review request emails
            </h2>
            <p className="card-sub">Sent to customers after you mark their order as fulfilled.</p>
          </div>
        </div>
        <div className="setting">
          <div>
            <label className="label" htmlFor="delay">
              When to send
            </label>
            <p className="help">Give customers time to receive and use the product first.</p>
          </div>
          <div className="range">
            <input
              id="delay"
              type="range"
              min={1}
              max={60}
              value={s.emailDelayDays}
              onChange={(e) => set("emailDelayDays", Number(e.target.value))}
            />
            <span className="range-n">
              {s.emailDelayDays} day{s.emailDelayDays === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <div className="setting">
          <div>
            <label className="label" htmlFor="from">
              Sender name
            </label>
            <p className="help">Customers see this as who the email is from.</p>
          </div>
          <input
            id="from"
            className="input"
            style={{ maxWidth: 280 }}
            maxLength={60}
            value={s.fromName}
            onChange={(e) => set("fromName", e.target.value)}
          />
        </div>
      </section>

      <section className="card" aria-labelledby="publish-title">
        <div className="card-head">
          <div>
            <h2 className="card-title" id="publish-title">
              Publishing
            </h2>
          </div>
        </div>
        <div className="setting">
          <div>
            <label className="label" htmlFor="auto">
              Publish new reviews automatically
            </label>
            <p className="help">
              When on, every new review goes live straight away, whatever its rating. When off, reviews wait for you
              in the Reviews tab. Publishing only good ratings would mislead shoppers, so the app doesn&apos;t offer it.
            </p>
          </div>
          <Toggle id="auto" checked={s.autoPublish} onChange={(v) => set("autoPublish", v)} />
        </div>
      </section>

      <section className="card" aria-labelledby="widget-title">
        <div className="card-head">
          <div>
            <h2 className="card-title" id="widget-title">
              Reviews on your product pages
            </h2>
            <p className="card-sub">Match the reviews section to your store&apos;s look.</p>
          </div>
        </div>
        <div className="setting">
          <div>
            <span className="label">Background</span>
            <p className="help">Pick the one that matches the product page behind it.</p>
          </div>
          <div className="seg" role="group" aria-label="Background">
            {(["light", "dark"] as const).map((t) => (
              <button key={t} type="button" aria-pressed={s.widgetTheme === t} onClick={() => set("widgetTheme", t)}>
                {t === "light" ? "Light" : "Dark"}
              </button>
            ))}
          </div>
        </div>
        <div className="setting">
          <div>
            <label className="label" htmlFor="star">
              Star colour
            </label>
            <p className="help">Use your brand colour or keep the classic gold.</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              id="star"
              type="color"
              className="swatch"
              value={s.starColor}
              onChange={(e) => set("starColor", e.target.value)}
            />
            <span style={{ ["--star" as string]: s.starColor } as React.CSSProperties}>
              <Stars rating={4} size={18} label={false} />
            </span>
          </div>
        </div>
        <div className="setting">
          <div>
            <label className="label" htmlFor="photos">
              Show reviews with photos first
            </label>
            <p className="help">Photo reviews tend to be the most useful to shoppers.</p>
          </div>
          <Toggle id="photos" checked={s.showPhotosFirst} onChange={(v) => set("showPhotosFirst", v)} />
        </div>
      </section>

      <div className="savebar">
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </button>
        {notice && (
          <span className={`notice notice-${notice.kind === "ok" ? "ok" : "error"}`} role="status">
            {notice.text}
          </span>
        )}
      </div>

      <PolicyCard store={storeName ?? "Our store"} />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="loading">Loading settings…</div>}>
      <Settings />
    </Suspense>
  );
}
