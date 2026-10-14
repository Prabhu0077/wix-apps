// Server-only: store-wide reviews with product names (carousel, all-reviews page).

import { accounts } from "@/lib/db";
import { getProductSummaries } from "@/lib/wix/catalog";
import { getWixClient } from "@/lib/wix/service";
import type { WidgetReview } from "@/lib/widget-data";

type AccountRow = typeof accounts.$inferSelect;

/** Adds product names; leaves them out if Wix can't be reached. */
export async function withProductNames(account: AccountRow, list: WidgetReview[]): Promise<WidgetReview[]> {
  const ids = [...new Set(list.map((r) => r.productId).filter((x): x is string => Boolean(x)))];
  if (ids.length === 0) return list;
  try {
    const names = await getProductSummaries(await getWixClient(account.wixInstanceId), account.wixInstanceId, ids);
    return list.map((r) => ({ ...r, productName: r.productId ? names.get(r.productId)?.name : undefined }));
  } catch {
    return list;
  }
}
