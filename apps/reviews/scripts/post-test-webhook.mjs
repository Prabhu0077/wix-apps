#!/usr/bin/env node
// Post a fake Wix webhook to a LOCAL dev server (task T1.1).
//
// The dev server must run with WIX_WEBHOOK_DEV_BYPASS=1 and NODE_ENV not
// "production" (see lib/wix/webhooks.ts); real Wix webhooks are signed JWTs
// and this script's unsigned JSON is refused everywhere else.
//
// Usage:
//   node scripts/post-test-webhook.mjs --instance <wixInstanceId> [--event fulfilled|removed|installed]
//        [--order test-order-0002] [--email you@example.com] [--products id1,id2] [--url http://localhost:3000]
//
// The instance ID must belong to an account row in your dev database.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const url = (args.url ?? "http://localhost:3000").replace(/\/$/, "");
const instanceId = args.instance;
const kind = args.event ?? "fulfilled";

if (!instanceId) {
  console.error("Missing --instance <wixInstanceId>");
  process.exit(1);
}
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url)) {
  console.error("Refusing to post to a non-local URL. This script is for local testing only.");
  process.exit(1);
}

let envelope;
if (kind === "fulfilled") {
  const here = dirname(fileURLToPath(import.meta.url));
  const event = JSON.parse(readFileSync(join(here, "..", "fixtures", "order-fulfilled.json"), "utf8"));
  const order = event.actionEvent.body.order;
  if (args.order) event.entityId = order.id = args.order;
  if (args.email) order.buyerInfo.email = args.email;
  if (args.products) order.lineItems = args.products.split(",").map((id) => ({ catalogReference: { catalogItemId: id.trim() } }));
  envelope = { eventType: "wix.ecom.v1.order_fulfilled", instanceId, data: JSON.stringify(event) };
} else if (kind === "removed") {
  envelope = { eventType: "AppRemoved", instanceId, data: "{}" };
} else if (kind === "installed") {
  envelope = { eventType: "AppInstalled", instanceId, data: "{}" };
} else {
  console.error(`Unknown --event ${kind}`);
  process.exit(1);
}

const res = await fetch(`${url}/api/wix/webhook`, {
  method: "POST",
  headers: { "Content-Type": "text/plain" },
  body: JSON.stringify(envelope),
});
console.log(res.status, await res.text());
console.log(
  kind === "fulfilled"
    ? "Check review_requests for the order (status SCHEDULED, or SKIPPED if over the monthly limit). Sending it again must not add a second row."
    : "Check accounts.uninstalled_at for the instance.",
);
