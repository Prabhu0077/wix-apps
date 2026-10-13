// Storefront reviews section as plain server-rendered HTML (task T5.2).
//
// Why not a React page: a Next.js page ships ~100 KB of framework JS, and
// this loads on every product page of the merchant's store. Here the only
// script is a few hundred bytes for sorting and "Read more"; CSS is inline.
// The section takes the store's look (light/dark, star colour), uses the
// system font, and carries no app branding (Wix bans "powered by").

import { fullDate, reviewDateLabel } from "@/lib/dates";
import type { WidgetData, WidgetReview } from "@/lib/widget-data";

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

function item(r: WidgetReview, now: Date): string {
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
  return `<li class="w-item" data-rating="${r.rating}" data-written="${Date.parse(r.writtenAt)}" data-photos="${r.media.length > 0 ? 1 : 0}">
<div class="w-meta"><span class="w-name">${esc(r.customerName)}</span>${stars(r.rating, 14, true)}${tags}<time class="w-date" datetime="${esc(r.writtenAt)}" title="${esc(fullDate(r.writtenAt))}">${esc(reviewDateLabel(r.writtenAt, now))}</time></div>
${body(r)}${media}${reply}</li>`;
}

// Sorting and "Read more" (no framework). Photos-first only applies to "Newest".
const SCRIPT = `(function(){var l=document.querySelector(".w-list"),s=document.querySelector(".w-sort"),pf=document.querySelector(".w").dataset.photosFirst==="1";
function k(e,a){return +e.dataset[a]}
function sort(){if(!l)return;var v=s?s.value:"newest",it=[].slice.call(l.children);it.sort(function(a,b){
if(v==="highest")return k(b,"rating")-k(a,"rating")||k(b,"written")-k(a,"written");
if(v==="lowest")return k(a,"rating")-k(b,"rating")||k(b,"written")-k(a,"written");
return (pf?k(b,"photos")-k(a,"photos"):0)||k(b,"written")-k(a,"written")});it.forEach(function(e){l.appendChild(e)})}
if(s)s.addEventListener("change",sort);sort();
document.addEventListener("click",function(e){var b=e.target.closest&&e.target.closest(".w-more");if(!b)return;var p=b.parentNode,o=b.getAttribute("aria-expanded")==="true";
p.querySelector(".w-short").hidden=!o;p.querySelector(".w-full").hidden=o;b.setAttribute("aria-expanded",o?"false":"true");b.textContent=o?"Read more":"Show less"})})();`;

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
  height: 6px;
  border-radius: 3px;
  background: var(--track);
  overflow: hidden;
}
.w-fill {
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

@media (max-width: 520px) {
  .w-head {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}`;

/** Full HTML document for the iframe. `null` data renders an empty page (unknown store). */
export function renderWidgetHtml(data: WidgetData | null, now: Date = new Date()): string {
  const head = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Customer reviews</title><style>body{margin:0;padding:0 16px;background:transparent}${WIDGET_CSS}</style></head><body>`;
  if (!data) return `${head}</body></html>`;

  const d = data.display;
  const starColor = d && /^#[0-9a-fA-F]{6}$/.test(d.starColor) ? d.starColor : "#F5A623";
  const open = `<section class="w" style="--star:${starColor}" data-theme="${d?.theme === "dark" ? "dark" : "light"}" data-photos-first="${d?.photosFirst ? 1 : 0}" aria-label="Customer reviews">`;
  const { total, average, distribution } = data.summary;

  if (total === 0) {
    return `${head}${open}<h2 class="w-title">Customer reviews</h2><p class="w-empty">No reviews yet.</p></section></body></html>`;
  }

  const bars = [5, 4, 3, 2, 1]
    .map((s) => {
      const n = distribution[s] ?? 0;
      return `<div class="w-bar"><span>${s} star${s === 1 ? "" : "s"}</span><div class="w-track" aria-hidden="true"><div class="w-fill" style="width:${((n / total) * 100).toFixed(1)}%"></div></div><span class="w-n">${n}</span></div>`;
    })
    .join("");

  const tools =
    total > 1
      ? `<div class="w-tools"><label><span class="w-tag" style="margin-right:8px">Sort by</span><select class="w-sort"><option value="newest">Newest</option><option value="highest">Highest rating</option><option value="lowest">Lowest rating</option></select></label></div>`
      : "";

  return `${head}${open}<div class="w-head"><div><h2 class="w-title">Customer reviews</h2><div class="w-avg">${average.toFixed(1)}</div>${stars(average, 18, true)}<p class="w-count">Based on ${total} review${total === 1 ? "" : "s"}</p></div><div class="w-bars">${bars}</div></div>${tools}<ul class="w-list">${data.reviews
    .map((r) => item(r, now))
    .join("")}</ul></section><script>${SCRIPT}</script></body></html>`;
}
