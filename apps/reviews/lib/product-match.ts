// Match an imported review's product column to a store product (T8.1):
// Wix product ID, then SKU, then slug (also from a product URL), then name.

import type { CatalogProduct } from "@/lib/wix/catalog";

const norm = (s: string) => s.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");

function slugFrom(value: string): string {
  // "https://store.com/product-page/cotton-tote?x=1" -> "cotton-tote"
  const noQuery = value.split(/[?#]/)[0].replace(/\/+$/, "");
  const last = noQuery.slice(noQuery.lastIndexOf("/") + 1);
  try {
    return decodeURIComponent(last).toLowerCase();
  } catch {
    return last.toLowerCase();
  }
}

export type ProductIndex = (value: string) => { id: string; by: "id" | "sku" | "slug" | "name" } | null;

export function buildProductIndex(products: CatalogProduct[]): ProductIndex {
  const byId = new Map<string, string>();
  const bySku = new Map<string, string>();
  const bySlug = new Map<string, string>();
  const byName = new Map<string, string | null>(); // null = more than one product has this name

  for (const p of products) {
    byId.set(p.id.toLowerCase(), p.id);
    if (p.sku) bySku.set(norm(p.sku), p.id);
    if (p.slug) bySlug.set(p.slug.toLowerCase(), p.id);
    const n = norm(p.name);
    byName.set(n, byName.has(n) ? null : p.id);
  }

  return (raw: string) => {
    const v = raw.trim();
    if (!v) return null;
    const lower = v.toLowerCase();
    const id = byId.get(lower);
    if (id) return { id, by: "id" };
    const sku = bySku.get(norm(v));
    if (sku) return { id: sku, by: "sku" };
    const slug = bySlug.get(/[/:]/.test(v) ? slugFrom(v) : lower);
    if (slug) return { id: slug, by: "slug" };
    const name = byName.get(norm(v));
    if (name) return { id: name, by: "name" };
    return null;
  };
}
