"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { AppSettings } from "@/app/api/settings/route";

const DEFAULT: AppSettings = {
  emailDelayDays: 14,
  fromName: "The Store Team",
  widgetTheme: "auto",
  showPhotosFirst: false,
  minRatingToPublish: 1,
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
        checked ? "bg-emerald-600" : "bg-slate-600"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const instance = searchParams.get("instance");

  const [settings, setSettings] = useState<AppSettings>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!instance) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/settings?instance=${encodeURIComponent(instance)}`);
      if (res.ok) {
        const data = await res.json();
        setSettings({ ...DEFAULT, ...data.settings });
      }
    } finally {
      setLoading(false);
    }
  }, [instance]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const save = async () => {
    if (!instance) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instance, settings }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Failed to save — please try again.");
    } finally {
      setSaving(false);
    }
  };

  function patch<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading…</div>;
  }

  return (
    <div className="p-6 space-y-8 max-w-xl">
      <div>
        <h1 className="text-xl font-semibold text-white">Settings</h1>
        <p className="text-slate-400 text-sm mt-0.5">Configure how NeoReviewKit works for your store</p>
      </div>

      {/* Email settings */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Email Review Requests</h2>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-5">
          {/* Delay */}
          <div className="space-y-2">
            <label className="block text-sm text-white font-medium">
              Days after order fulfillment
            </label>
            <p className="text-xs text-slate-400">How long to wait before emailing the customer for a review</p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={60}
                value={settings.emailDelayDays}
                onChange={(e) => patch("emailDelayDays", parseInt(e.target.value))}
                className="flex-1 accent-emerald-500"
              />
              <span className="w-14 text-center text-white font-semibold tabular-nums bg-slate-700 rounded-lg py-1 text-sm">
                {settings.emailDelayDays}d
              </span>
            </div>
          </div>

          {/* From name */}
          <div className="space-y-2">
            <label className="block text-sm text-white font-medium">
              Sender name
            </label>
            <p className="text-xs text-slate-400">Shown as the sender in review request emails</p>
            <input
              type="text"
              maxLength={60}
              value={settings.fromName}
              onChange={(e) => patch("fromName", e.target.value)}
              placeholder="The Store Team"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500"
            />
          </div>
        </div>
      </section>

      {/* Widget settings */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Review Widget</h2>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-5">
          {/* Theme */}
          <div className="space-y-2">
            <label className="block text-sm text-white font-medium">Widget theme</label>
            <p className="text-xs text-slate-400">Matches how the reviews widget looks on your store</p>
            <div className="flex gap-2">
              {(["auto", "light", "dark"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => patch("widgetTheme", t)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                    settings.widgetTheme === t
                      ? "bg-slate-600 text-white"
                      : "bg-slate-900 text-slate-400 hover:text-white border border-slate-700"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Show photos first */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white font-medium">Show reviews with photos first</p>
              <p className="text-xs text-slate-400 mt-0.5">Prioritises photo reviews at the top of the widget</p>
            </div>
            <Toggle
              checked={settings.showPhotosFirst}
              onChange={(v) => patch("showPhotosFirst", v)}
            />
          </div>

          {/* Min rating */}
          <div className="space-y-2">
            <label className="block text-sm text-white font-medium">
              Minimum rating to auto-publish
            </label>
            <p className="text-xs text-slate-400">Reviews below this rating will require manual approval</p>
            <div className="flex gap-1">
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => patch("minRatingToPublish", n)}
                  className={`w-9 h-9 rounded-lg text-sm font-semibold transition-colors ${
                    settings.minRatingToPublish === n
                      ? "bg-amber-500 text-black"
                      : "bg-slate-900 text-slate-400 border border-slate-700 hover:border-slate-500"
                  }`}
                >
                  {n}★
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Save bar */}
      <div className="flex items-center gap-4">
        <button
          onClick={save}
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors"
        >
          {saving ? "Saving…" : "Save Settings"}
        </button>
        {saved && <span className="text-emerald-400 text-sm">✓ Saved</span>}
        {error && <span className="text-red-400 text-sm">{error}</span>}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading…</div>}>
      <SettingsContent />
    </Suspense>
  );
}
