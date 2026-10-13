// Run: npx tsx tests/import.test.ts
import assert from "node:assert/strict";

import { parseCsv } from "@/lib/csv-parse";
import { cleanRow, parseDate, parseRating } from "@/lib/import";
import { guessMapping, IMPORT_FIELDS, type ImportRow } from "@/lib/import-fields";
import { buildProductIndex } from "@/lib/product-match";
import { mapWixReview } from "@/lib/wix/reviews-import";

// CSV parsing
const rows = parseCsv('﻿product_handle,rating,body,reviewer_name\r\ncotton-tote,5,"Great, really ""great""\nsecond line",Priya\r\n\r\n');
assert.deepEqual(rows, [["product_handle", "rating", "body", "reviewer_name"], ["cotton-tote", "5", 'Great, really "great"\nsecond line', "Priya"]]);
assert.deepEqual(parseCsv("a;b\n1;2"), [["a", "b"], ["1", "2"]]);

// Column guessing for common exports
const judgeme = ["title", "body", "rating", "review_date", "source", "curated", "reviewer_name", "reviewer_email", "product_id", "product_handle", "reply", "picture_urls"];
const g = guessMapping(judgeme);
assert.equal(g.body, 1); assert.equal(g.rating, 2); assert.equal(g.date, 3); assert.equal(g.name, 6);
assert.equal(g.email, 7); assert.equal(g.product, 8); assert.equal(g.reply, 10); assert.equal(g.photos, 11); assert.equal(g.title, 0);

// Ratings and dates
assert.equal(parseRating("4.6"), 5); assert.equal(parseRating("3/5"), 3); assert.equal(parseRating("80/100"), 4);
assert.equal(parseRating("★★★★"), 4); assert.equal(parseRating("0"), null); assert.equal(parseRating("abc"), null);
const now = new Date("2026-10-13T12:00:00Z");
assert.equal(parseDate("2026-03-12", now)?.toISOString().slice(0, 10), "2026-03-12");
assert.equal(parseDate("12/03/2026", now), null, "ambiguous dd/mm vs mm/dd is not guessed");
assert.equal(parseDate("2030-01-01", now), null, "future dates rejected");

// Product matching: id, sku, url, slug, name; duplicate names don't match
const match = buildProductIndex([
  { id: "a1b2", name: "Cotton Tote Bag", slug: "cotton-tote", sku: "TOTE-01" },
  { id: "c3d4", name: "Ceramic Mug", slug: "ceramic-mug-sage", sku: null },
  { id: "e5f6", name: "Mug", slug: "mug-1", sku: null },
  { id: "g7h8", name: "Mug", slug: "mug-2", sku: null },
]);
assert.deepEqual(match("A1B2"), { id: "a1b2", by: "id" });
assert.deepEqual(match("tote-01"), { id: "a1b2", by: "sku" });
assert.deepEqual(match("https://shop.example/product-page/ceramic-mug-sage?ref=x"), { id: "c3d4", by: "slug" });
assert.deepEqual(match("  cotton   tote bag "), { id: "a1b2", by: "name" });
assert.equal(match("Mug"), null);

// 1,000-row file end to end (T8.1 acceptance: imports; report lists misses)
const header = "product_handle,rating,title,body,reviewer_name,review_date";
const lines = [header];
for (let i = 0; i < 1000; i++) {
  const product = i % 10 === 9 ? "unknown-product" : i % 2 ? "cotton-tote" : "ceramic-mug-sage";
  const rating = i % 50 === 49 ? "" : String((i % 5) + 1);
  lines.push(`${product},${rating},Title ${i},"Body text number ${i}, with a comma",Name ${i},2026-0${(i % 9) + 1}-15`);
}
const parsed = parseCsv(lines.join("\n"));
const mapping = guessMapping(parsed[0]);
let ok = 0, noProduct = 0, bad = 0;
const refs = new Set<string>();
parsed.slice(1).forEach((cells, j) => {
  const row: ImportRow = { line: j + 2 };
  for (const f of IMPORT_FIELDS) if (mapping[f.key] !== undefined) row[f.key] = cells[mapping[f.key]!];
  const c = cleanRow(row, now);
  if (!c.ok) { bad++; return; }
  if (!match(c.review.productKey)) { noProduct++; return; }
  refs.add(c.review.sourceRef); ok++;
});
assert.equal(bad, 20, "rows with no rating are reported");
assert.equal(ok + noProduct + bad, 1000);
assert.equal(refs.size, ok, "every imported row has its own dedupe key");
// Re-cleaning the same row gives the same key (re-import adds nothing)
const r1 = cleanRow({ line: 2, product: "x", rating: "5", body: "Same text", name: "A", date: "2026-01-02" }, now);
const r2 = cleanRow({ line: 9, product: "X", rating: "5", body: "Same text", name: "a", date: "2026-01-02" }, now);
assert.ok(r1.ok && r2.ok && r1.review.sourceRef === r2.review.sourceRef);

// Wix Reviews mapping
const w = mapWixReview({ id: "r1", entityId: "p1", content: { title: "Nice", body: "Fits well", rating: 4, media: [{ image: { url: "https://static.wixstatic.com/a.jpg" } }] },
  author: { authorName: "Sam" }, moderation: { moderationStatus: "IN_MODERATION" }, verified: true, reviewDate: "2025-12-01T00:00:00Z", createdDate: "2025-12-02T00:00:00Z", reply: { message: "Thanks" } });
assert.ok(w); assert.equal(w!.status, "PENDING"); assert.equal(w!.body, "Nice\nFits well"); assert.equal(w!.sourceRef, "wix:r1");
assert.equal(w!.writtenAt?.toISOString(), "2025-12-01T00:00:00.000Z"); assert.deepEqual(w!.photos, ["https://static.wixstatic.com/a.jpg"]);
assert.equal(mapWixReview({ id: "r2", entityId: "p1", content: { rating: 9, body: "x" } }), null);

console.log(`all pass (1,000-row file: ${ok} imported, ${noProduct} no product match, ${bad} invalid)`);
