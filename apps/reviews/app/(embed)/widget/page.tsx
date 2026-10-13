"use client";

// Storefront reviews section, embedded on Wix product pages.
// URL: /widget?instanceId=<id>&productId=<id>
// Takes the merchant's display settings; carries no app branding.

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Stars } from "@/components/ui/Stars";
import { fullDate, reviewDateLabel } from "@/lib/dates";

type Review = {
  id: string;
  customerName: string;
  rating: number;
  body: string;
  reply: string | null;
  verified: boolean;
  imported: boolean;
  writtenAt: string;
  media: { kind: string; url: string; thumbUrl: string }[];
};
type Data = {
  reviews: Review[];
  summary: { total: number; average: number; distribution: Record<string, number> };
  display: { theme: "light" | "dark"; starColor: string; photosFirst: boolean } | null;
};
type Sort = "newest" | "highest" | "lowest";

function Item({ r }: { r: Review }) {
  const [open, setOpen] = useState(false);
  const long = r.body.length > 280;
  const text = long && !open ? `${r.body.slice(0, 280).trimEnd()}…` : r.body;

  return (
    <li className="w-item">
      <div className="w-meta">
        <span className="w-name">{r.customerName}</span>
        <Stars rating={r.rating} size={14} />
        {r.verified && <span className="w-tag">Verified buyer</span>}
        {r.imported && <span className="w-tag">Imported review</span>}
        <time className="w-date" dateTime={r.writtenAt} title={fullDate(r.writtenAt)}>
          {reviewDateLabel(r.writtenAt)}
        </time>
      </div>
      <p className="w-body">
        {text}
        {long && (
          <button className="w-more" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? "Show less" : "Read more"}
          </button>
        )}
      </p>
      {r.media.length > 0 && (
        <div className="w-media">
          {r.media.map((m, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={m.thumbUrl} alt={`Photo ${i + 1} from ${r.customerName}`} loading="lazy" />
          ))}
        </div>
      )}
      {r.reply && (
        <div className="w-reply">
          <p className="w-reply-label">Reply from the store</p>
          <p>{r.reply}</p>
        </div>
      )}
    </li>
  );
}

function Widget() {
  const params = useSearchParams();
  const instanceId = params.get("instanceId");
  const productId = params.get("productId");
  const [data, setData] = useState<Data | null>(null);
  const [sort, setSort] = useState<Sort>("newest");

  useEffect(() => {
    if (!instanceId || !productId) return;
    fetch(`/api/widget/products/${encodeURIComponent(productId)}?instanceId=${encodeURIComponent(instanceId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, [instanceId, productId]);

  const sorted = useMemo(() => {
    const list = [...(data?.reviews ?? [])];
    list.sort((a, b) => {
      if (data?.display?.photosFirst && sort === "newest") {
        const diff = Number(b.media.length > 0) - Number(a.media.length > 0);
        if (diff) return diff;
      }
      if (sort === "highest") return b.rating - a.rating;
      if (sort === "lowest") return a.rating - b.rating;
      return Date.parse(b.writtenAt) - Date.parse(a.writtenAt);
    });
    return list;
  }, [data, sort]);

  if (!data) return null; // Render nothing until loaded; never flash an error on a shop page.

  const style = { ["--star" as string]: data.display?.starColor ?? "#F5A623" } as React.CSSProperties;
  const { total, average, distribution } = data.summary;

  if (total === 0) {
    return (
      <section className="w" style={style} data-theme={data.display?.theme ?? "light"} aria-label="Customer reviews">
        <h2 className="w-title">Customer reviews</h2>
        <p className="w-empty">No reviews yet.</p>
      </section>
    );
  }

  return (
    <section className="w" style={style} data-theme={data.display?.theme ?? "light"} aria-label="Customer reviews">
      <div className="w-head">
        <div>
          <h2 className="w-title">Customer reviews</h2>
          <div className="w-avg">{average.toFixed(1)}</div>
          <Stars rating={average} size={18} />
          <p className="w-count">
            Based on {total} review{total === 1 ? "" : "s"}
          </p>
        </div>
        <div className="w-bars">
          {[5, 4, 3, 2, 1].map((s) => {
            const n = distribution[s] ?? 0;
            return (
              <div className="w-bar" key={s}>
                <span>
                  {s} star{s === 1 ? "" : "s"}
                </span>
                <div className="w-track" aria-hidden="true">
                  <div className="w-fill" style={{ width: `${(n / total) * 100}%` }} />
                </div>
                <span className="w-n">{n}</span>
              </div>
            );
          })}
        </div>
      </div>

      {total > 1 && (
        <div className="w-tools">
          <label>
            <span className="w-tag" style={{ marginRight: 8 }}>
              Sort by
            </span>
            <select className="w-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="newest">Newest</option>
              <option value="highest">Highest rating</option>
              <option value="lowest">Lowest rating</option>
            </select>
          </label>
        </div>
      )}

      <ul className="w-list">
        {sorted.map((r) => (
          <Item key={r.id} r={r} />
        ))}
      </ul>
    </section>
  );
}

export default function WidgetPage() {
  return (
    <Suspense fallback={null}>
      <Widget />
    </Suspense>
  );
}
