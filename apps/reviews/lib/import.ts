// Review import: server-side cleaning and validation of one mapped row.
// Pure functions, no database. Column definitions are in import-fields.ts.

import { createHash } from "crypto";

import type { ImportRow } from "@/lib/import-fields";
export type { ImportRow };

export function parseRating(raw: string | undefined): number | null {
  if (!raw) return null;
  const stars = (raw.match(/★/g) ?? []).length;
  if (stars >= 1 && stars <= 5) return stars;
  const m = raw.replace(",", ".").match(/(\d+(?:\.\d+)?)\s*(?:\/\s*(\d+))?/);
  if (!m) return null;
  let n = parseFloat(m[1]);
  const outOf = m[2] ? parseFloat(m[2]) : 5;
  if (outOf === 10 || outOf === 100) n = (n / outOf) * 5;
  const r = Math.round(n);
  return r >= 1 && r <= 5 ? r : null;
}

export function parseYes(raw: string | undefined): boolean {
  return /^(y|yes|true|1|verified)$/i.test((raw ?? "").trim());
}

/** ISO and unambiguous dates only; anything we can't read becomes null (import date used). */
export function parseDate(raw: string | undefined, now: Date = new Date()): Date | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  let d: Date | null = null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) d = new Date(s.length === 10 ? `${s}T12:00:00Z` : s);
  else if (/^\d{10,13}$/.test(s)) d = new Date(s.length === 10 ? Number(s) * 1000 : Number(s));
  else {
    const t = Date.parse(s); // e.g. "March 12, 2026", RFC 2822
    if (!Number.isNaN(t) && /[a-z]/i.test(s)) d = new Date(t);
  }
  if (!d || Number.isNaN(d.getTime())) return null;
  if (d.getTime() > now.getTime() + 24 * 60 * 60 * 1000 || d.getFullYear() < 2000) return null;
  return d;
}

export function parsePhotoUrls(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(/[\s,|;]+/)
    .map((u) => u.trim())
    .filter((u) => /^https:\/\/[^\s"'<>]+$/i.test(u))
    .slice(0, 5);
}

export type CleanReview = {
  productKey: string;
  rating: number;
  body: string;
  name: string;
  email: string;
  writtenAt: Date | null;
  verified: boolean;
  reply: string | null;
  photos: string[];
  incentivized: boolean;
  sourceRef: string;
};

export function cleanRow(row: ImportRow, now: Date = new Date()): { ok: true; review: CleanReview } | { ok: false; reason: string } {
  const productKey = (row.product ?? "").trim();
  if (!productKey) return { ok: false, reason: "No product" };
  const rating = parseRating(row.rating);
  if (!rating) return { ok: false, reason: "Rating missing or not 1–5" };
  const title = (row.title ?? "").trim();
  const text = (row.body ?? "").trim();
  const body = title && !text.startsWith(title) ? (text ? `${title}\n${text}` : title) : text;
  if (!body) return { ok: false, reason: "No review text" };
  const writtenAt = parseDate(row.date, now);
  const name = (row.name ?? "").trim().slice(0, 120) || "Customer";
  const sourceRef =
    "csv:" +
    createHash("sha256")
      .update([productKey.toLowerCase(), rating, body, name.toLowerCase(), writtenAt?.toISOString().slice(0, 10) ?? ""].join("\u0000"))
      .digest("hex")
      .slice(0, 32);
  return {
    ok: true,
    review: {
      productKey,
      rating,
      body: body.slice(0, 5000),
      name,
      email: (row.email ?? "").trim().toLowerCase().slice(0, 254),
      writtenAt,
      verified: parseYes(row.verified),
      reply: (row.reply ?? "").trim().slice(0, 1000) || null,
      photos: parsePhotoUrls(row.photos),
      incentivized: parseYes(row.incentivized),
      sourceRef,
    },
  };
}
