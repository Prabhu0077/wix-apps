// Email transport: picks ZeptoMail when its token is set and sends the
// request ZeptoMail documents (no network: fetch is replaced).

import assert from "node:assert/strict";

process.env.ZEPTOMAIL_TOKEN = "test-token";
process.env.EMAIL_FROM_ADDRESS = "reviews@example.com";
process.env.DATABASE_URL = "postgres://u:p@localhost/db";
process.env.WIX_APP_ID = "x";
process.env.WIX_APP_SECRET = "x";
process.env.WIX_WEBHOOK_PUBLIC_KEY = "x";
process.env.WIX_TOKENS_MASTER_KEY = "0".repeat(64);
process.env.CRON_SECRET = "0123456789abcdef";

const calls: { url: string; init: RequestInit }[] = [];
let reply = new Response(JSON.stringify({ message: "OK" }), { status: 200 });
globalThis.fetch = (async (url: string, init: RequestInit) => {
  calls.push({ url, init });
  return reply;
}) as typeof fetch;

async function main() {
  const { sendEmail, emailProvider } = await import("../lib/email/transport");

  assert.equal(emailProvider(), "zeptomail");
  await sendEmail({
    fromName: "Shop",
    to: "a@b.com",
    subject: "Hi",
    html: "<p>x</p>",
    text: "x",
    headers: { "List-Unsubscribe": "<https://u>" },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.zeptomail.com/v1.1/email");
  const h = calls[0].init.headers as Record<string, string>;
  assert.equal(h.Authorization, "Zoho-enczapikey test-token");
  const body = JSON.parse(String(calls[0].init.body));
  assert.deepEqual(body.from, { address: "reviews@example.com", name: "Shop" });
  assert.deepEqual(body.to, [{ email_address: { address: "a@b.com" } }]);
  assert.equal(body.htmlbody, "<p>x</p>");
  assert.equal(body.textbody, "x");
  assert.deepEqual(body.mime_headers, { "List-Unsubscribe": "<https://u>" });

  // A refusal surfaces ZeptoMail's code and message.
  reply = new Response(JSON.stringify({ error: { code: "TM_4001", message: "Access Denied", details: [{ message: "Invalid API Token found" }] } }), { status: 401 });
  await assert.rejects(
    sendEmail({ fromName: "S", to: "a@b.com", subject: "s", html: "h", text: "t" }),
    /ZeptoMail refused the email \(TM_4001\): Invalid API Token found/,
  );
  console.log("transport: all pass");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
