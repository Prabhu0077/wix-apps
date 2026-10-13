// Review import: the columns we understand and a best guess at which CSV
// column holds each. Safe for the browser (no Node modules).

export const IMPORT_FIELDS = [
  { key: "product", label: "Product (ID, SKU, URL, slug or name)", required: true },
  { key: "rating", label: "Star rating (1–5)", required: true },
  { key: "body", label: "Review text", required: true },
  { key: "title", label: "Review title", required: false },
  { key: "name", label: "Reviewer name", required: false },
  { key: "email", label: "Reviewer email", required: false },
  { key: "date", label: "Date written", required: false },
  { key: "verified", label: "Verified buyer (yes/no)", required: false },
  { key: "reply", label: "Store reply", required: false },
  { key: "photos", label: "Photo URLs", required: false },
  { key: "incentivized", label: "Got an incentive (yes/no)", required: false },
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number]["key"];
export type ImportRow = Partial<Record<ImportField, string>> & { line: number };

// Header names used by common review apps' exports (Judge.me, Loox, Yotpo,
// Fera, Stamped, Wix Reviews) and plain spreadsheets.
const GUESSES: Record<ImportField, RegExp> = {
  product: /^(product[_ ]?(id|handle|sku|url|name|title)?|handle|sku|item)$/i,
  rating: /^(rating|stars?|score|review[_ ]?(rating|score))$/i,
  body: /^(body|review|content|text|comment|review[_ ]?(body|content|text))$/i,
  title: /^(title|headline|review[_ ]?title|summary)$/i,
  name: /^(name|author|reviewer|customer[_ ]?name|reviewer[_ ]?name|display[_ ]?name)$/i,
  email: /^(e-?mail|reviewer[_ ]?email|customer[_ ]?email)$/i,
  date: /^(date|created|created[_ ]?at|review[_ ]?date|date[_ ]?(created|written))$/i,
  verified: /^(verified|verified[_ ]?(buyer|purchase))$/i,
  reply: /^(reply|response|store[_ ]?reply|reply[_ ]?(content|text)|merchant[_ ]?reply)$/i,
  photos: /^(photos?|images?|picture[_ ]?urls?|photo[_ ]?urls?|media|image[_ ]?urls?)$/i,
  incentivized: /^(incentivi[sz]ed|incentive)$/i,
};

/** Best-guess column for each field, by header name. */
export function guessMapping(headers: string[]): Partial<Record<ImportField, number>> {
  const out: Partial<Record<ImportField, number>> = {};
  const taken = new Set<number>();
  for (const f of IMPORT_FIELDS) {
    const i = headers.findIndex((h, idx) => !taken.has(idx) && GUESSES[f.key].test(h.trim()));
    if (i >= 0) {
      out[f.key] = i;
      taken.add(i);
    }
  }
  return out;
}
