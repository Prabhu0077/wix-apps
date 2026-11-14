// Run: pnpm test   (or: npx tsx tests/core.test.ts)
// Pure-logic checks: plan limits, CSV writer, catalog reads, store address,
// email footer, widget HTML. No database or network.
import assert from "node:assert/strict";

import { csvCell } from "@/lib/csv";
import { renderReviewRequestEmail } from "@/lib/email/review-request";
import { monthStartUtc, nextMonthStartUtc, usageLevel } from "@/lib/plans";
import { renderWidgetHtml } from "@/lib/widget-html";
import { getProductSummaries, parseCatalogVersion } from "@/lib/wix/catalog";
import type { WixClient } from "@/lib/wix/client";
import { formatAddress, profileFrom } from "@/lib/wix/site";

async function main() {
  // Plans
  assert.equal(usageLevel(39, 50), "ok");
  assert.equal(usageLevel(40, 50), "warning");
  assert.equal(usageLevel(50, 50), "reached");
  const d = new Date("2026-12-31T23:30:00Z");
  assert.equal(monthStartUtc(d).toISOString(), "2026-12-01T00:00:00.000Z");
  assert.equal(nextMonthStartUtc(d).toISOString(), "2027-01-01T00:00:00.000Z");

  // CSV writer
  assert.equal(csvCell('a "b", c'), '"a ""b"", c"');
  assert.equal(csvCell("=SUM(A1)"), "'=SUM(A1)");
  assert.equal(csvCell(null), "");

  // Catalog V1 / V3
  assert.equal(parseCatalogVersion("V3_CATALOG"), "V3");
  const fake = (version: string, names: Record<string, string>) =>
    ({
      get: async (url: string) => {
        if (url.includes("provision/version")) return { catalogVersion: version };
        const v3 = url.includes("/stores/v3/products/");
        const id = decodeURIComponent(url.split("/products/")[1].split("?")[0]);
        const name = names[(v3 ? "V3:" : "V1:") + id];
        if (!name) throw new Error("404");
        return { product: { name } };
      },
    }) as unknown as WixClient;
  assert.equal((await getProductSummaries(fake("V3_CATALOG", { "V3:p1": "Bag" }), "t-v3", ["p1"])).get("p1")?.name, "Bag");
  assert.equal((await getProductSummaries(fake("V1_CATALOG", { "V1:p1": "Old" }), "t-v1", ["p1"])).get("p1")?.name, "Old");
  assert.equal((await getProductSummaries(fake("STORES_NOT_INSTALLED", {}), "t-none", ["p1"])).size, 0);

  // Store address
  assert.equal(formatAddress({ streetNumber: "221B", street: "Baker Street", city: "London", country: "GB" }), "221B Baker Street, London, GB");
  assert.equal(formatAddress({ country: "IN" }), null);
  assert.equal(profileFrom({ properties: { businessName: "", siteDisplayName: "Shop" } }).storeName, "Shop");

  // Email footer: unsubscribe link, escaped address
  const e = renderReviewRequestEmail({
    storeName: "S & Co",
    productNames: ["Bag"],
    reviewUrl: "https://a/r",
    unsubscribeUrl: "https://a/u",
    storeAddress: "1 <Main> St",
  });
  assert.ok(e.html.includes("https://a/u") && e.html.includes("1 &lt;Main&gt; St") && !e.html.includes("<Main>"));
  assert.ok(e.text.includes("Unsubscribe: https://a/u"));

  // Widget HTML: escaped, no framework scripts, tiny
  const html = renderWidgetHtml(
    {
      reviews: [
        {
          id: "1",
          customerName: "<img src=x onerror=alert(1)>",
          rating: 5,
          body: "Good",
          reply: null,
          verified: true,
          imported: false,
          incentivized: true,
          helpful: 2,
          writtenAt: "2026-10-10T00:00:00Z",
          media: [],
        },
      ],
      summary: { total: 1, average: 5, distribution: { 5: 1 } },
      display: { theme: "light", starColor: "#000000;}</style><script>", photosFirst: false },
    },
    new Date("2026-10-13T00:00:00Z"),
  );
  assert.ok(!html.includes("<img src=x") && !html.includes("</style><script>"));
  assert.ok(html.includes("Received an incentive for this review"));
  assert.ok(!html.includes("_next/"));
  assert.ok(Buffer.byteLength(html) < 30_000, "widget page stays under 30 KB");

  console.log("core: all pass");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
