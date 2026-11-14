// Shared bits for the storefront HTML routes under /widget.

export const EMBED_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  // Shoppers see new reviews within a few minutes.
  "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
  "X-Content-Type-Options": "nosniff",
};

export const NO_STORE_HEADERS = { ...EMBED_HEADERS, "Cache-Control": "no-store" };

export function validId(v: string | null, max: number): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= max && /^[\w-]+$/.test(v);
}
