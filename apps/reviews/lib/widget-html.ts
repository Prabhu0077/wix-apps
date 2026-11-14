// Storefront reviews section as plain server-rendered HTML (task T5.2).
//
// Why not a React page: a Next.js page ships ~100 KB of framework JS, and
// this loads on every product page of the merchant's store. Here the only
// script is a few hundred bytes for sorting and "Read more"; CSS is inline.
// The section takes the store's look (light/dark, star colour), uses the
// system font, and carries no app branding (Wix bans "powered by").

import { fullDate, reviewDateLabel } from "@/lib/dates";
import type { Display, Summary, WidgetData, WidgetReview } from "@/lib/widget-data";

const STAR_PATH =
  "M10 1.6l2.47 5.3 5.8.68-4.29 3.96 1.13 5.73L10 14.4l-5.11 2.87 1.13-5.73L1.73 7.58l5.8-.68z";
const LONG = 280;

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stars(rating: number, size: number, label: boolean): string {
  const rounded = Math.round(rating);
  const svgs = [1, 2, 3, 4, 5]
    .map(
      (n) =>
        `<svg width="${size}" height="${size}" viewBox="0 0 20 20" aria-hidden="true"><path d="${STAR_PATH}" class="${n <= rounded ? "star-on" : "star-off"}"/></svg>`,
    )
    .join("");
  return label
    ? `<span class="stars" role="img" aria-label="${rating.toFixed(1)} out of 5 stars">${svgs}</span>`
    : `<span class="stars" aria-hidden="true">${svgs}</span>`;
}

function body(r: WidgetReview): string {
  if (r.body.length <= LONG) return `<p class="w-body">${esc(r.body)}</p>`;
  const short = r.body.slice(0, LONG).trimEnd();
  return `<p class="w-body"><span class="w-short">${esc(short)}…</span><span class="w-full" hidden>${esc(r.body)}</span> <button type="button" class="w-more" aria-expanded="false">Read more</button></p>`;
}

function item(r: WidgetReview, now: Date, opts: { helpful?: boolean } = {}): string {
  const tags = [
    r.verified ? '<span class="w-tag">Verified buyer</span>' : "",
    r.imported ? '<span class="w-tag">Imported review</span>' : "",
    r.incentivized ? '<span class="w-tag">Received an incentive for this review</span>' : "",
  ].join("");
  const media = r.media.length
    ? `<div class="w-media">${r.media
        .map((m, i) => `<img src="${esc(m.thumbUrl)}" alt="Photo ${i + 1} from ${esc(r.customerName)}" loading="lazy">`)
        .join("")}</div>`
    : "";
  const reply = r.reply
    ? `<div class="w-reply"><p class="w-reply-label">Reply from the store</p><p>${esc(r.reply)}</p></div>`
    : "";
  const product = r.productName ? `<p class="w-product">${esc(r.productName)}</p>` : "";
  const helpful =
    opts.helpful !== false
      ? `<div class="w-foot"><button type="button" class="w-helpful" data-id="${esc(r.id)}" aria-pressed="false">Helpful<span class="w-hn">${r.helpful > 0 ? ` (${r.helpful})` : ""}</span></button></div>`
      : "";
  return `<li class="w-item" data-rating="${r.rating}" data-written="${Date.parse(r.writtenAt)}" data-photos="${r.media.length > 0 ? 1 : 0}" data-helpful="${r.helpful}">
${product}<div class="w-meta"><span class="w-name">${esc(r.customerName)}</span>${stars(r.rating, 14, true)}${tags}<time class="w-date" datetime="${esc(r.writtenAt)}" title="${esc(fullDate(r.writtenAt))}">${esc(reviewDateLabel(r.writtenAt, now))}</time></div>
${body(r)}${media}${reply}${helpful}</li>`;
}

// Sorting, star filter, "Read more" and "Helpful" votes (no framework).
// Photos-first only applies to "Newest". Votes go to our API; the browser
// remembers its own votes so the button stays pressed.
const SCRIPT = `(function(){var w=document.querySelector(".w");if(!w)return;var l=w.querySelector(".w-list"),s=w.querySelector(".w-sort"),pf=w.dataset.photosFirst==="1",inst=w.dataset.instance,only=0;
function k(e,a){return +e.dataset[a]}
function sort(){if(!l)return;var v=s?s.value:"newest",it=[].slice.call(l.children);it.sort(function(a,b){
if(v==="highest")return k(b,"rating")-k(a,"rating")||k(b,"written")-k(a,"written");
if(v==="lowest")return k(a,"rating")-k(b,"rating")||k(b,"written")-k(a,"written");
if(v==="helpful")return k(b,"helpful")-k(a,"helpful")||k(b,"written")-k(a,"written");
return (pf?k(b,"photos")-k(a,"photos"):0)||k(b,"written")-k(a,"written")});it.forEach(function(e){l.appendChild(e)})}
function filter(n){only=only===n?0:n;var shown=0;[].forEach.call(l.children,function(e){var ok=!only||k(e,"rating")===only;e.hidden=!ok;if(ok)shown++});
[].forEach.call(w.querySelectorAll(".w-bar"),function(b){b.setAttribute("aria-pressed",String(+b.dataset.star===only))});
var f=w.querySelector(".w-filter");if(f){f.hidden=!only;f.querySelector("span").textContent=only?"Showing "+shown+" "+only+"-star review"+(shown===1?"":"s"):""}}
if(s)s.addEventListener("change",sort);sort();
var voted={};try{voted=JSON.parse(localStorage.getItem("w-voted")||"{}")}catch(e){}
[].forEach.call(w.querySelectorAll(".w-helpful"),function(b){if(voted[b.dataset.id])b.setAttribute("aria-pressed","true")});
w.addEventListener("click",function(e){var t=e.target.closest?e.target:null;if(!t)return;
var bar=t.closest(".w-bar");if(bar&&l){filter(+bar.dataset.star);return}
if(t.closest(".w-clear")){filter(only);return}
var b=t.closest(".w-more");if(b){var p=b.parentNode,o=b.getAttribute("aria-expanded")==="true";p.querySelector(".w-short").hidden=!o;p.querySelector(".w-full").hidden=o;b.setAttribute("aria-expanded",o?"false":"true");b.textContent=o?"Read more":"Show less";return}
var h=t.closest(".w-helpful");if(h&&h.getAttribute("aria-pressed")!=="true"&&inst){h.setAttribute("aria-pressed","true");var li=h.closest(".w-item"),n=k(li,"helpful")+1;li.dataset.helpful=n;h.querySelector(".w-hn").textContent=" ("+n+")";voted[h.dataset.id]=1;try{localStorage.setItem("w-voted",JSON.stringify(voted))}catch(e){}
fetch("/api/widget/helpful",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({instanceId:inst,reviewId:h.dataset.id})}).catch(function(){})}})})();`;

// Tells the embedding custom element (public/elements/reviews.js) how tall
// the page is, so the iframe never shows a scrollbar. Same message shape is
// checked in elements/reviews-element.ts.
export const HEIGHT_SCRIPT = `(function(){if(window.parent===window)return;var last=0;function s(){var h=Math.ceil(document.documentElement.scrollHeight);if(h!==last){last=h;window.parent.postMessage({source:"bodham-reviews",height:h},"*")}}addEventListener("load",s);if(window.ResizeObserver)new ResizeObserver(s).observe(document.documentElement);else setInterval(s,1000);s()})();`;

export const WIDGET_CSS = `.w {
  --text: #1f2933;
  --text-2: #5f6b78;
  --line: #e3e7eb;
  --track: #eef1f4;
  --reply-bg: rgba(0, 0, 0, 0.035);
  --star: #f5a623;
  --star-off: #d9dee4;
  font: 400 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--text);
  max-width: 760px;
  margin: 0 auto;
  padding: 8px 0 28px;
}
.w[data-theme="dark"] {
  --text: #f1f3f5;
  --text-2: #b4bdc6;
  --line: rgba(255, 255, 255, 0.14);
  --track: rgba(255, 255, 255, 0.12);
  --reply-bg: rgba(255, 255, 255, 0.06);
  --star-off: rgba(255, 255, 255, 0.22);
}
.w * {
  box-sizing: border-box;
}
.w h2,
.w p {
  margin: 0;
}
.w button {
  font: inherit;
  color: inherit;
}
.w :focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
  border-radius: 4px;
}

.stars {
  display: inline-flex;
  gap: 2px;
  vertical-align: middle;
}
.star-on {
  fill: var(--star);
}
.star-off {
  fill: var(--star-off);
}

.w-head {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 32px;
  align-items: center;
  padding-bottom: 22px;
  border-bottom: 1px solid var(--line);
}
.w-title {
  font-size: 20px;
  font-weight: 650;
  margin-bottom: 6px;
}
.w-avg {
  font-size: 40px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.w-count {
  color: var(--text-2);
  font-size: 14px;
  margin-top: 4px;
}
.w-bars {
  display: grid;
  gap: 6px;
  max-width: 360px;
}
.w-bar {
  display: grid;
  grid-template-columns: 50px 1fr 28px;
  gap: 10px;
  align-items: center;
  font-size: 13px;
  color: var(--text-2);
}
.w-track {
  display: block;
  height: 6px;
  border-radius: 3px;
  background: var(--track);
  overflow: hidden;
}
.w-fill {
  display: block;
  height: 100%;
  background: var(--star);
}
.w-n {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.w-tools {
  display: flex;
  justify-content: flex-end;
  padding: 14px 0 4px;
}
.w-sort {
  font: inherit;
  font-size: 14px;
  color: var(--text);
  background: transparent;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 6px 10px;
}

.w-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.w-item {
  padding: 18px 0;
  display: grid;
  gap: 8px;
}
.w-item + .w-item {
  border-top: 1px solid var(--line);
}
.w-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.w-name {
  font-weight: 600;
}
.w-tag {
  font-size: 13px;
  color: var(--text-2);
}
.w-date {
  margin-left: auto;
  font-size: 13px;
  color: var(--text-2);
}
.w-body {
  max-width: 70ch;
}
.w-more {
  color: inherit;
  background: none;
  border: none;
  padding: 0;
  margin-left: 6px;
  text-decoration: underline;
  cursor: pointer;
  font-size: 14px;
}
.w-media {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.w-media img {
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: 6px;
}
.w-reply {
  background: var(--reply-bg);
  border-radius: 6px;
  padding: 10px 14px;
  font-size: 14px;
  max-width: 70ch;
}
.w-reply-label {
  font-weight: 600;
  font-size: 13px;
}
.w-empty {
  padding: 20px 0;
  color: var(--text-2);
}

.w-bar {
  background: none;
  border: 0;
  padding: 2px 0;
  font: inherit;
  font-size: 13px;
  color: var(--text-2);
  cursor: pointer;
  text-align: left;
  width: 100%;
}
.w-bar[aria-pressed="true"] {
  color: var(--text);
  font-weight: 600;
}
.w-filter {
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 14px;
  color: var(--text-2);
  padding-top: 12px;
}
.w [hidden] {
  display: none !important;
}
.w-clear {
  background: none;
  border: 0;
  padding: 0;
  text-decoration: underline;
  cursor: pointer;
  font-size: 14px;
  color: inherit;
}
.w-foot {
  display: flex;
}
.w-helpful {
  background: none;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 13px;
  color: var(--text-2);
  cursor: pointer;
}
.w-helpful[aria-pressed="true"] {
  color: var(--text);
  border-color: currentColor;
}
.w-product {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}

@media (max-width: 520px) {
  .w-head {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}`;

/** Full HTML document for the iframe. `null` data renders an empty page (unknown store). */
export function renderWidgetHtml(data: WidgetData | null, now: Date = new Date(), instanceId = ""): string {
  const head = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Customer reviews</title><style>body{margin:0;padding:0 16px;background:transparent}${WIDGET_CSS}</style></head><body>`;
  if (!data) return `${head}<script>${HEIGHT_SCRIPT}</script></body></html>`;

  const d = data.display;
  const starColor = d && /^#[0-9a-fA-F]{6}$/.test(d.starColor) ? d.starColor : "#F5A623";
  const open = `<section class="w" style="--star:${starColor}" data-theme="${d?.theme === "dark" ? "dark" : "light"}" data-photos-first="${d?.photosFirst ? 1 : 0}" data-instance="${esc(instanceId)}" aria-label="Customer reviews">`;
  const { total, average, distribution } = data.summary;

  if (total === 0) {
    return `${head}${open}<h2 class="w-title">Customer reviews</h2><p class="w-empty">No reviews yet.</p></section></body></html>`;
  }

  const bars = [5, 4, 3, 2, 1]
    .map((s) => {
      const n = distribution[s] ?? 0;
      return `<button type="button" class="w-bar" data-star="${s}" aria-pressed="false" aria-label="Show ${s}-star reviews (${n})"><span>${s} star${s === 1 ? "" : "s"}</span><span class="w-track" aria-hidden="true"><span class="w-fill" style="width:${((n / total) * 100).toFixed(1)}%"></span></span><span class="w-n">${n}</span></button>`;
    })
    .join("");

  const tools =
    total > 1
      ? `<div class="w-tools"><label><span class="w-tag" style="margin-right:8px">Sort by</span><select class="w-sort"><option value="newest">Newest</option><option value="highest">Highest rating</option><option value="lowest">Lowest rating</option><option value="helpful">Most helpful</option></select></label></div>`
      : "";

  return `${head}${open}<div class="w-head"><div><h2 class="w-title">Customer reviews</h2><div class="w-avg">${average.toFixed(1)}</div>${stars(average, 18, true)}<p class="w-count">Based on ${total} review${total === 1 ? "" : "s"}</p></div><div class="w-bars">${bars}</div></div><div class="w-filter" hidden><span></span><button type="button" class="w-clear">Show all reviews</button></div>${tools}<ul class="w-list">${data.reviews
    .map((r) => item(r, now))
    .join("")}</ul></section><script>${SCRIPT}</script><script>${HEIGHT_SCRIPT}</script></body></html>`;
}


// ---------- Small storefront pieces ----------

function themeAttrs(display: Display | null): { starColor: string; theme: "light" | "dark" } {
  const starColor = display && /^#[0-9a-fA-F]{6}$/.test(display.starColor) ? display.starColor : "#F5A623";
  return { starColor, theme: display?.theme === "dark" ? "dark" : "light" };
}

function doc(title: string, css: string, bodyHtml: string, script = ""): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title><style>body{margin:0;padding:0;background:transparent}${css}</style></head><body>${bodyHtml}${script ? `<script>${script}</script>` : ""}<script>${HEIGHT_SCRIPT}</script></body></html>`;
}

/**
 * Star rating badge for the product title area (free): "4.6 ★★★★★ (28 reviews)".
 * Renders nothing when the product has no published reviews.
 */
export function renderBadgeHtml(summary: Summary | null, display: Display | null): string {
  if (!summary || summary.total === 0) return doc("Rating", WIDGET_CSS, "");
  const { starColor, theme } = themeAttrs(display);
  const label = `${summary.total} review${summary.total === 1 ? "" : "s"}`;
  return doc(
    "Rating",
    `${WIDGET_CSS}.w-badge{display:flex;align-items:center;gap:6px;padding:2px 0;font-size:14px}.w-badge b{font-weight:650}`,
    `<div class="w w-badge" style="--star:${starColor};padding:0" data-theme="${theme}">` +
      `<b>${summary.average.toFixed(1)}</b>${stars(summary.average, 16, true)}<span class="w-count" style="margin:0">(${label})</span></div>`,
  );
}

/**
 * Store-wide reviews (Starter): a horizontal carousel for the home page, or a
 * full "all reviews" page with paging. Every rating is shown, newest first —
 * a highlights-only carousel would be selective display (PRD R12).
 */
export function renderStoreReviewsHtml(opts: {
  kind: "carousel" | "all";
  reviews: WidgetReview[];
  summary: Summary;
  display: Display | null;
  instanceId: string;
  page?: number;
  hasMore?: boolean;
  now?: Date;
}): string {
  const { starColor, theme } = themeAttrs(opts.display);
  const now = opts.now ?? new Date();
  const s = opts.summary;
  if (s.total === 0) return doc("Customer reviews", WIDGET_CSS, "");
  const head = `<div class="w-sum"><span class="w-avg" style="font-size:28px">${s.average.toFixed(1)}</span>${stars(s.average, 18, true)}<span class="w-count" style="margin:0">Based on ${s.total} review${s.total === 1 ? "" : "s"}</span></div>`;

  if (opts.kind === "carousel") {
    const cards = opts.reviews
      .map(
        (r) =>
          `<li class="w-card">${r.productName ? `<p class="w-product">${esc(r.productName)}</p>` : ""}${stars(r.rating, 14, true)}<p class="w-card-body">${esc(r.body.length > 220 ? `${r.body.slice(0, 220).trimEnd()}…` : r.body)}</p><p class="w-tag">${esc(r.customerName)}${r.verified ? " · Verified buyer" : ""}${r.incentivized ? " · Received an incentive" : ""}</p></li>`,
      )
      .join("");
    const css = `${WIDGET_CSS}.w-sum{display:flex;align-items:center;gap:10px;padding:4px 0 14px}.w-cards{list-style:none;margin:0;padding:0 0 8px;display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory}.w-card{flex:0 0 280px;scroll-snap-align:start;border:1px solid var(--line);border-radius:10px;padding:14px 16px;display:grid;gap:8px;align-content:start}.w-card-body{font-size:14px;margin:0}`;
    return doc(
      "Customer reviews",
      css,
      `<section class="w" style="--star:${starColor};max-width:none;padding:8px 16px" data-theme="${theme}" aria-label="Customer reviews"><h2 class="w-title">What customers say</h2>${head}<ul class="w-cards">${cards}</ul></section>`,
    );
  }

  const page = opts.page ?? 0;
  const nav =
    page > 0 || opts.hasMore
      ? `<nav class="w-pager" aria-label="Pages">${page > 0 ? `<a href="?instanceId=${encodeURIComponent(opts.instanceId)}&page=${page - 1}">Newer reviews</a>` : "<span></span>"}${opts.hasMore ? `<a href="?instanceId=${encodeURIComponent(opts.instanceId)}&page=${page + 1}">Older reviews</a>` : ""}</nav>`
      : "";
  const css = `${WIDGET_CSS}.w-sum{display:flex;align-items:center;gap:10px;padding:4px 0 10px}.w-pager{display:flex;justify-content:space-between;padding:16px 0;font-size:14px}.w-pager a{color:inherit}`;
  return doc(
    "Customer reviews",
    css,
    `<section class="w" style="--star:${starColor};padding:8px 16px 28px" data-theme="${theme}" data-instance="${esc(opts.instanceId)}" aria-label="All customer reviews"><h2 class="w-title">Customer reviews</h2>${head}<ul class="w-list">${opts.reviews
      .map((r) => item(r, now))
      .join("")}</ul>${nav}</section>`,
    SCRIPT,
  );
}
