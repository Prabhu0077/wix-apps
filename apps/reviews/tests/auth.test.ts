// Run: pnpm test   (or: npx tsx tests/auth.test.ts)
// New Wix OAuth (client credentials), account fields from Get App Instance,
// plan mapping, and the storefront custom-element helpers. No database or
// network: fetch is replaced and env values are dummies set below.
import assert from "node:assert/strict";

// Dummy values so lib/env validates. Nothing here is a real credential.
Object.assign(process.env, {
  DATABASE_URL: "postgres://test:test@localhost:5432/test",
  WIX_APP_ID: "app-id-test",
  WIX_APP_SECRET: "secret-test",
  WIX_WEBHOOK_PUBLIC_KEY: "public-key-test",
  WIX_TOKENS_MASTER_KEY: "0".repeat(64),
  RESEND_API_KEY: "re_test",
  RESEND_FROM_ADDRESS: "reviews@example.com",
  CRON_SECRET: "cron-secret-test-123",
});

type FetchArgs = { url: string; body: unknown };

async function main() {
  const { appTokenRequest, createAppToken, instanceIdFromToken } = await import("@/lib/wix/oauth");
  const { planFromInstance } = await import("@/lib/wix/service");
  const { accountFieldsFrom } = await import("@/lib/wix/account");
  const { frameSrc, heightFrom } = await import("../elements/frame");

  // ---------- Create Access Token ----------
  assert.deepEqual(appTokenRequest("inst-1"), {
    grant_type: "client_credentials",
    client_id: "app-id-test",
    client_secret: "secret-test",
    instance_id: "inst-1",
  });

  const calls: FetchArgs[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init?: { body?: string }) => {
    calls.push({ url, body: init?.body ? JSON.parse(init.body) : null });
    if (url.endsWith("/oauth2/token")) {
      return new Response(JSON.stringify({ access_token: "tok-1", expires_in: 14400 }), { status: 200 });
    }
    if (url.endsWith("/oauth2/token-info")) {
      const token = (JSON.parse(init!.body!) as { token: string }).token;
      return token === "good"
        ? new Response(JSON.stringify({ instanceId: "inst-9" }), { status: 200 })
        : new Response("{}", { status: 401 });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  try {
    const t = await createAppToken("inst-1", 1_000);
    assert.equal(t.accessToken, "tok-1");
    assert.equal(t.expiresAt, 1_000 + 14400 * 1000);
    assert.equal(calls[0].url, "https://www.wixapis.com/oauth2/token");

    assert.equal(await instanceIdFromToken("good"), "inst-9");
    assert.equal(await instanceIdFromToken("Bearer good"), "inst-9", "Bearer prefix stripped");
    assert.equal(await instanceIdFromToken("bad"), null);
    assert.equal(await instanceIdFromToken(""), null);
    assert.equal(await instanceIdFromToken("x".repeat(5000)), null, "oversized token refused without a call");

    // A failed token request must not echo the secret back.
    globalThis.fetch = (async () => new Response("denied", { status: 400 })) as unknown as typeof fetch;
    await assert.rejects(createAppToken("inst-1"), (err: Error) => !err.message.includes("secret-test"));
  } finally {
    globalThis.fetch = realFetch;
  }

  // ---------- Plan and account fields from Get App Instance ----------
  assert.equal(planFromInstance(undefined), "FREE");
  assert.equal(planFromInstance({ isFree: true }), "FREE");
  assert.equal(planFromInstance({ isFree: false, billing: { packageName: "Pro monthly" } }), "PRO");
  assert.equal(planFromInstance({ isFree: false, billing: { packageName: "growth" } }), "GROWTH");
  assert.equal(planFromInstance({ isFree: false }), "STARTER");

  assert.deepEqual(
    accountFieldsFrom({
      instance: { isFree: false, billing: { packageName: "STARTER" } },
      site: { siteId: "site-1", ownerInfo: { email: "owner@shop.in" } },
    }),
    { siteId: "site-1", ownerEmail: "owner@shop.in", plan: "STARTER" },
  );
  assert.deepEqual(accountFieldsFrom({ site: { siteId: "s", ownerEmail: "legacy@shop.in" } }).ownerEmail, "legacy@shop.in");
  assert.deepEqual(accountFieldsFrom(null), { siteId: "pending", ownerEmail: "pending@example.com", plan: "FREE" });

  // ---------- Custom element helpers ----------
  const o = "https://app.example";
  assert.equal(frameSrc("reviews", o, "i1", "p1"), "https://app.example/widget?instanceId=i1&productId=p1");
  assert.equal(frameSrc("badge", o, "i1", "p 1"), "https://app.example/widget/badge?instanceId=i1&productId=p+1");
  assert.equal(frameSrc("carousel", o, "i1", null), "https://app.example/widget/carousel?instanceId=i1");
  assert.equal(frameSrc("all", o, "i1", "ignored"), "https://app.example/widget/all?instanceId=i1");
  assert.equal(frameSrc("reviews", o, "i1", null), null, "product widget needs a product");
  assert.equal(frameSrc("carousel", o, null, null), null, "nothing without a store");

  assert.equal(heightFrom({ source: "bodham-reviews", height: 412.2 }), 413);
  assert.equal(heightFrom({ source: "other", height: 100 }), null);
  assert.equal(heightFrom({ source: "bodham-reviews", height: -1 }), null);
  assert.equal(heightFrom({ source: "bodham-reviews", height: 1e9 }), 20000);
  assert.equal(heightFrom("bodham-reviews"), null);

  console.log("auth: all pass");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
