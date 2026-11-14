// Server-only: hands one finished email to the configured sending service.
// Zoho ZeptoMail when ZEPTOMAIL_TOKEN is set, otherwise Resend. Templates and
// business rules live elsewhere; this file only talks to the provider.

import { Resend } from "resend";

import { env } from "@/lib/env";

export type OutgoingEmail = {
  fromName: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
};

const ZEPTO_DEFAULT_URL = "https://api.zeptomail.com/v1.1/email";

/** The From address, or a clear error when email is not set up. */
function fromAddress(): string {
  const from = env.EMAIL_FROM_ADDRESS ?? env.RESEND_FROM_ADDRESS;
  if (!from) throw new Error("Email is not configured: set EMAIL_FROM_ADDRESS");
  return from;
}

export function emailProvider(): "zeptomail" | "resend" | null {
  if (env.ZEPTOMAIL_TOKEN) return "zeptomail";
  if (env.RESEND_API_KEY) return "resend";
  return null;
}

export async function sendEmail(mail: OutgoingEmail): Promise<void> {
  const provider = emailProvider();
  if (provider === "zeptomail") return sendViaZepto(mail);
  if (provider === "resend") return sendViaResend(mail);
  throw new Error("Email is not configured: set ZEPTOMAIL_TOKEN (or RESEND_API_KEY)");
}

async function sendViaZepto(mail: OutgoingEmail): Promise<void> {
  // The token from ZeptoMail's "Send Mail Token" page; it may be pasted with
  // or without its "Zoho-enczapikey " prefix.
  const raw = env.ZEPTOMAIL_TOKEN ?? "";
  const auth = raw.startsWith("Zoho-enczapikey") ? raw : `Zoho-enczapikey ${raw}`;
  const res = await fetch(env.ZEPTOMAIL_API_URL ?? ZEPTO_DEFAULT_URL, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      from: { address: fromAddress(), name: mail.fromName },
      to: [{ email_address: { address: mail.to } }],
      subject: mail.subject,
      htmlbody: mail.html,
      textbody: mail.text,
      ...(mail.headers ? { mime_headers: mail.headers } : {}),
    }),
  });
  if (res.ok) return;
  // Error bodies carry a code and message, never the token.
  const body = (await res.json().catch(() => null)) as
    | { error?: { code?: string; message?: string; details?: { message?: string }[] }; data?: { error_code?: string; message?: string } }
    | null;
  const detail =
    body?.error?.details?.[0]?.message ?? body?.error?.message ?? body?.data?.message ?? `HTTP ${res.status}`;
  const code = body?.error?.code ?? body?.data?.error_code ?? "";
  throw new Error(`ZeptoMail refused the email${code ? ` (${code})` : ""}: ${detail}`);
}

let resendClient: Resend | null = null;
async function sendViaResend(mail: OutgoingEmail): Promise<void> {
  resendClient ??= new Resend(env.RESEND_API_KEY);
  const result = await resendClient.emails.send({
    from: `${mail.fromName} <${fromAddress()}>`,
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    headers: mail.headers,
  });
  if (result.error) throw new Error(result.error.message);
}
