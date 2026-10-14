"use client";

import { Suspense, useEffect, useState } from "react";

import { PolicyCard } from "@/components/dashboard/PolicyCard";
import { Stars } from "@/components/ui/Stars";
import { api, ApiError, useInstance } from "@/lib/dashboard-client";
import { FEATURE_MIN_PLAN, hasFeature, REMINDER_AFTER_DAYS, type Feature } from "@/lib/features";
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/settings";

function Toggle({
  id,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      className="toggle"
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  );
}

const PLAN_NAME: Record<string, string> = { STARTER: "Starter", PRO: "Pro", GROWTH: "Growth" };

/** "Starter plan" label with a link to the Plan tab, shown on locked settings. */
function PlanLock({ feature, instance }: { feature: Feature; instance: string | null }) {
  const href = instance ? `/billing?instance=${encodeURIComponent(instance)}` : "/billing";
  return (
    <p className="help">
      <span className="badge badge-hidden">{PLAN_NAME[FEATURE_MIN_PLAN[feature]]} plan</span>{" "}
      <a href={href}>See plans</a>
    </p>
  );
}

function Settings() {
  const instance = useInstance();
  const [s, setS] = useState<AppSettings | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [plan, setPlan] = useState<string>("FREE");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    api<{ settings: AppSettings; storeName: string | null; plan?: string }>(instance, "/api/settings")
      .then((d) => {
        setS(d.settings);
        setStoreName(d.storeName);
        setPlan(d.plan ?? "FREE");
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

  async function sendTest() {
    setTesting(true);
    setNotice(null);
    try {
      const d = await api<{ sentTo: string }>(instance, "/api/settings/test-email", { method: "POST", body: {} });
      setNotice({ kind: "ok", text: `Test email sent to ${d.sentTo}. It uses your saved settings.` });
    } catch (e: unknown) {
      setNotice({ kind: "error", text: e instanceof ApiError ? e.message : "The test email didn't send." });
    } finally {
      setTesting(false);
    }
  }

  const canRemind = hasFeature(plan, "reminder");
  const canCoupon = hasFeature(plan, "coupon");

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
        <div className="setting">
          <div>
            <label className="label" htmlFor="remind">
              Send one reminder
            </label>
            <p className="help">
              If a customer hasn&apos;t reviewed {REMINDER_AFTER_DAYS} days after the first email, send one short
              reminder. Never more than one.
            </p>
            {!canRemind && <PlanLock feature="reminder" instance={instance} />}
          </div>
          <Toggle
            id="remind"
            checked={canRemind && s.reminderEnabled}
            disabled={!canRemind}
            onChange={(v) => set("reminderEnabled", v)}
          />
        </div>
        <div className="setting">
          <div>
            <span className="label">See what customers get</span>
            <p className="help">Sends the email to your own address, using your saved settings. Its links open a sample form.</p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={sendTest} disabled={testing}>
            {testing ? "Sending…" : "Send me a test email"}
          </button>
        </div>
      </section>

      <section className="card" aria-labelledby="coupon-title">
        <div className="card-head">
          <div>
            <h2 className="card-title" id="coupon-title">
              Thank-you coupon
            </h2>
            <p className="card-sub">
              Give a one-time discount code to every customer who sends a review, whatever the rating.
            </p>
          </div>
        </div>
        <div className="setting">
          <div>
            <label className="label" htmlFor="coupon">
              Give a discount code for a review
            </label>
            <p className="help">
              The email mentions it, and the code shows after the review is sent. Single use, valid for 90 days. These
              reviews are marked &quot;Received an incentive&quot; on your store, as consumer law requires.
            </p>
            {!canCoupon && <PlanLock feature="coupon" instance={instance} />}
          </div>
          <Toggle
            id="coupon"
            checked={canCoupon && s.couponEnabled}
            disabled={!canCoupon}
            onChange={(v) => set("couponEnabled", v)}
          />
        </div>
        {canCoupon && s.couponEnabled && (
          <div className="setting">
            <div>
              <label className="label" htmlFor="percent">
                Discount
              </label>
              <p className="help">Between 5% and 50% off one order.</p>
            </div>
            <div className="range">
              <input
                id="percent"
                type="range"
                min={5}
                max={50}
                step={5}
                value={s.couponPercent}
                onChange={(e) => set("couponPercent", Number(e.target.value))}
              />
              <span className="range-n">{s.couponPercent}%</span>
            </div>
          </div>
        )}
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
        <div className="setting">
          <div>
            <span className="label">Spam check</span>
            <p className="help">
              Reviews with links, phone numbers or email addresses, bad language, all capitals or repeated text always
              wait for you, even with automatic publishing on. The rating never matters.
            </p>
          </div>
          <span className="badge badge-approved">Always on</span>
        </div>
        <div className="setting">
          <div>
            <label className="label" htmlFor="digest">
              Email me about new reviews
            </label>
            <p className="help">One email a day, only on days new reviews arrive.</p>
          </div>
          <Toggle id="digest" checked={s.notifyNewReviews} onChange={(v) => set("notifyNewReviews", v)} />
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
