// Product lookups that work on both Wix Stores catalogs (PRD R6).
//
// Every Wix store runs Catalog V1 or Catalog V3, never both, and the two APIs
// are not compatible. Wix asks apps to check the version at the start of
// each flow (Catalog Versioning API), and will not list an app that only
// speaks V1. All product reads in this app go through this file.
//
// Docs (checked 13 Oct 2026):
//   version: GET https://www.wixapis.com/stores/v3/provision/version
//            -> { catalogVersion: "V1_CATALOG" | "V3_CATALOG" | "STORES_NOT_INSTALLED" }
//   V1:      GET https://www.wixapis.com/stores-reader/v1/products/{id}
//            -> product.name, product.media.mainMedia.{thumbnail,image}.url
//   V3:      GET https://www.wixapis.com/stores/v3/products/{id}?fields=THUMBNAIL
//            -> product.name, product.media.main.{thumbnail,image}.url
//
// App permissions needed in the Wix app dashboard: "Read Products" (V1),
// "Read products in v3 catalog" and "Read v3 catalog" (version check).

import type { WixClient } from "./client";

export type CatalogVersion = "V1" | "V3" | "NONE";

export type ProductSummary = { id: string; name: string; imageUrl?: string };

const VERSION_URL = "https://www.wixapis.com/stores/v3/provision/version";
const V1_PRODUCT_URL = (id: string) => `https://www.wixapis.com/stores-reader/v1/products/${encodeURIComponent(id)}`;
const V3_PRODUCT_URL = (id: string) =>
  `https://www.wixapis.com/stores/v3/products/${encodeURIComponent(id)}?fields=THUMBNAIL`;

// Most orders have a handful of products; this bounds the Wix calls per flow.
const MAX_PRODUCTS = 20;

// A site can move from V1 to V3, so the answer is cached briefly, per warm
// server instance only.
const VERSION_TTL_MS = 10 * 60 * 1000;
const versionCache = new Map<string, { version: CatalogVersion; at: number }>();

type V1Media = { url?: string };
type V1Response = {
  product?: { name?: string; media?: { mainMedia?: { thumbnail?: V1Media; image?: V1Media } } };
};
type V3Response = {
  product?: { name?: string; media?: { main?: { thumbnail?: { url?: string }; image?: { url?: string } } } };
};

export function parseCatalogVersion(raw: unknown): CatalogVersion | null {
  if (raw === "V1_CATALOG") return "V1";
  if (raw === "V3_CATALOG") return "V3";
  if (raw === "STORES_NOT_INSTALLED") return "NONE";
  return null;
}

/** Catalog version for a site, or null if Wix couldn't tell us. */
export async function getCatalogVersion(client: WixClient, cacheKey: string): Promise<CatalogVersion | null> {
  const hit = versionCache.get(cacheKey);
  if (hit && Date.now() - hit.at < VERSION_TTL_MS) return hit.version;
  try {
    const res = await client.get<{ catalogVersion?: string }>(VERSION_URL);
    const version = parseCatalogVersion(res?.catalogVersion);
    if (version) versionCache.set(cacheKey, { version, at: Date.now() });
    return version;
  } catch (err) {
    console.warn("[catalog] version check failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export function summaryFromV1(id: string, res: V1Response | undefined): ProductSummary | null {
  const p = res?.product;
  if (!p?.name) return null;
  const m = p.media?.mainMedia;
  return { id, name: p.name, imageUrl: m?.thumbnail?.url || m?.image?.url || undefined };
}

export function summaryFromV3(id: string, res: V3Response | undefined): ProductSummary | null {
  const p = res?.product;
  if (!p?.name) return null;
  const m = p.media?.main;
  return { id, name: p.name, imageUrl: m?.thumbnail?.url || m?.image?.url || undefined };
}

async function fetchOne(client: WixClient, id: string, version: "V1" | "V3"): Promise<ProductSummary | null> {
  try {
    return version === "V1"
      ? summaryFromV1(id, await client.get<V1Response>(V1_PRODUCT_URL(id)))
      : summaryFromV3(id, await client.get<V3Response>(V3_PRODUCT_URL(id)));
  } catch {
    return null; // deleted or hidden product, or no permission — caller shows a generic label
  }
}

/**
 * Name and image for each product ID that Wix could resolve. Missing IDs are
 * simply absent from the map; never throws.
 *
 * If the version check fails, each product is tried on V3 first (new stores),
 * then V1, so a missing permission or an outage degrades instead of breaking.
 */
export async function getProductSummaries(
  client: WixClient,
  cacheKey: string,
  productIds: string[],
): Promise<Map<string, ProductSummary>> {
  const out = new Map<string, ProductSummary>();
  const ids = [...new Set(productIds)].slice(0, MAX_PRODUCTS);
  if (ids.length === 0) return out;

  const version = await getCatalogVersion(client, cacheKey);
  if (version === "NONE") return out;
  const order: ("V1" | "V3")[] = version ? [version] : ["V3", "V1"];

  const results = await Promise.all(
    ids.map(async (id) => {
      for (const v of order) {
        const found = await fetchOne(client, id, v);
        if (found) return found;
      }
      return null;
    }),
  );
  for (const r of results) if (r) out.set(r.id, r);
  return out;
}

// ---------- Full product list (for matching imported reviews) ----------

export type CatalogProduct = { id: string; name: string; slug: string; sku: string | null };

const V1_QUERY_URL = "https://www.wixapis.com/stores-reader/v1/products/query";
const V3_QUERY_URL = "https://www.wixapis.com/stores/v3/products/query";
const MAX_CATALOG = 10_000;
const LIST_TTL_MS = 10 * 60 * 1000;
const listCache = new Map<string, { products: CatalogProduct[]; at: number }>();

type V1QueryResponse = { products?: { id?: string; name?: string; slug?: string; sku?: string }[]; totalResults?: number };
type V3QueryResponse = {
  products?: { id?: string; name?: string; slug?: string }[];
  pagingMetadata?: { hasNext?: boolean; cursors?: { next?: string } };
};

async function listV1(client: WixClient): Promise<CatalogProduct[]> {
  const out: CatalogProduct[] = [];
  for (let offset = 0; offset < MAX_CATALOG; offset += 100) {
    const res = await client.post<V1QueryResponse>(V1_QUERY_URL, { query: { paging: { limit: 100, offset } } });
    const page = res?.products ?? [];
    for (const p of page) {
      if (p.id && p.name) out.push({ id: p.id, name: p.name, slug: p.slug ?? "", sku: p.sku || null });
    }
    if (page.length < 100) break;
  }
  return out;
}

async function listV3(client: WixClient): Promise<CatalogProduct[]> {
  const out: CatalogProduct[] = [];
  let cursor: string | undefined;
  while (out.length < MAX_CATALOG) {
    const res = await client.post<V3QueryResponse>(V3_QUERY_URL, {
      query: { cursorPaging: cursor ? { limit: 100, cursor } : { limit: 100 } },
    });
    // V3 query returns no variant data, so no SKUs (match by ID, URL, slug or name instead).
    for (const p of res?.products ?? []) {
      if (p.id && p.name) out.push({ id: p.id, name: p.name, slug: p.slug ?? "", sku: null });
    }
    cursor = res?.pagingMetadata?.cursors?.next;
    if (!res?.pagingMetadata?.hasNext || !cursor) break;
  }
  return out;
}

/** Every visible product in the store, on V1 or V3. Cached 10 minutes per store. */
export async function listCatalogProducts(client: WixClient, cacheKey: string): Promise<CatalogProduct[]> {
  const hit = listCache.get(cacheKey);
  if (hit && Date.now() - hit.at < LIST_TTL_MS) return hit.products;
  const version = await getCatalogVersion(client, cacheKey);
  if (version === "NONE") return [];
  const products = version === "V1" ? await listV1(client) : await listV3(client);
  listCache.set(cacheKey, { products, at: Date.now() });
  return products;
}
