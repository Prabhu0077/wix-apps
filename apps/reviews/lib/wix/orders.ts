// Server-only: recent fulfilled orders, for "Ask recent customers" (backfill).
//
// Docs (checked 13 Oct 2026): POST https://www.wixapis.com/ecom/v1/orders/search
// { search: { filter, sort, cursorPaging: { limit, cursor } } }
//   -> { orders: Order[], metadata: { cursors: { next } } }
// Permission: Read Orders.

import type { OrderLike } from "@/lib/schedule";

import type { WixClient } from "./client";

const SEARCH_URL = "https://www.wixapis.com/ecom/v1/orders/search";
const PAGE = 100;

type SearchResponse = { orders?: (OrderLike & { id?: string })[]; metadata?: { cursors?: { next?: string | null } } };

/** Search body for fulfilled, paid orders created since `since`, newest first. */
export function fulfilledOrdersQuery(since: Date, cursor?: string) {
  return {
    search: {
      filter: {
        status: "APPROVED",
        fulfillmentStatus: "FULFILLED",
        createdDate: { $gte: since.toISOString() },
      },
      sort: [{ fieldName: "createdDate", order: "DESC" }],
      cursorPaging: cursor ? { limit: PAGE, cursor } : { limit: PAGE },
    },
  };
}

/** Up to `max` fulfilled orders created since `since` (pages of 100). */
export async function searchFulfilledOrders(
  client: WixClient,
  since: Date,
  max = 300,
): Promise<(OrderLike & { id: string })[]> {
  const out: (OrderLike & { id: string })[] = [];
  let cursor: string | undefined;
  while (out.length < max) {
    const res = await client.post<SearchResponse>(SEARCH_URL, fulfilledOrdersQuery(since, cursor));
    for (const o of res.orders ?? []) if (o.id) out.push(o as OrderLike & { id: string });
    cursor = res.metadata?.cursors?.next ?? undefined;
    if (!cursor || (res.orders ?? []).length === 0) break;
  }
  return out.slice(0, max);
}
