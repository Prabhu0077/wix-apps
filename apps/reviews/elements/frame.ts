// Pure helpers for the storefront custom elements (no DOM, no Wix SDK), so
// they can be unit-tested.

export type Kind = "reviews" | "badge" | "carousel" | "all";

const PATH: Record<Kind, string> = {
  reviews: "/widget",
  badge: "/widget/badge",
  carousel: "/widget/carousel",
  all: "/widget/all",
};
export const NEEDS_PRODUCT: Record<Kind, boolean> = { reviews: true, badge: true, carousel: false, all: false };

/** iframe src for a kind, or null if a required id is missing. */
export function frameSrc(kind: Kind, origin: string, inst: string | null, productId: string | null): string | null {
  if (!inst || (NEEDS_PRODUCT[kind] && !productId)) return null;
  const q = new URLSearchParams({ instanceId: inst });
  if (NEEDS_PRODUCT[kind] && productId) q.set("productId", productId);
  return `${origin}${PATH[kind]}?${q.toString()}`;
}

/** Height from our iframe's message (see HEIGHT_SCRIPT in lib/widget-html.ts), else null. */
export function heightFrom(data: unknown): number | null {
  const d = data as { source?: unknown; height?: unknown } | null;
  if (!d || d.source !== "bodham-reviews" || typeof d.height !== "number") return null;
  if (!Number.isFinite(d.height) || d.height < 0) return null;
  return Math.min(Math.ceil(d.height), 20000);
}
