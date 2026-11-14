// Bundle elements/reviews-element.ts -> public/elements/reviews.js (one
// minified file with the Wix SDK inside). Runs before `next build`.
// Reads only WIX_APP_ID (public) and NEXT_PUBLIC_APP_BASE_URL from the env.

import { build } from "esbuild";

const appId = process.env.WIX_APP_ID ?? "";
const origin = (process.env.NEXT_PUBLIC_APP_BASE_URL ?? "").replace(/\/$/, "");
if (!appId) console.warn("[build-elements] WIX_APP_ID is not set; the storefront elements can't identify the store.");

await build({
  entryPoints: ["elements/reviews-element.ts"],
  outfile: "public/elements/reviews.js",
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2019"],
  legalComments: "none",
  define: {
    __APP_ID__: JSON.stringify(appId),
    __APP_ORIGIN__: JSON.stringify(origin),
  },
  logLevel: "warning",
});
console.log("[build-elements] public/elements/reviews.js written");
