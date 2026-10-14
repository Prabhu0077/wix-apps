// Daily "new reviews" email to the store owner (Free feature). Plain and
// short: how many arrived, how many wait for approval, the latest few.
// Sent by the daily cron only when something new arrived.

export type DigestReview = { customerName: string; rating: number; body: string; status: string };

type Props = {
  storeName: string;
  total: number; // new reviews since the last digest
  pending: number; // of those, waiting for the merchant
  latest: DigestReview[]; // up to 5, newest first
  manageUrl: string;
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function clip(s: string, n = 160): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

export function renderDigestEmail({ storeName, total, pending, latest, manageUrl }: Props) {
  const subject = `${total} new review${total === 1 ? "" : "s"} for ${storeName}`;
  const waiting =
    pending > 0 ? `${pending} ${pending === 1 ? "is" : "are"} waiting for you to publish.` : "All of them are already published.";

  const text = [
    `${subject}.`,
    waiting,
    ``,
    ...latest.map((r) => `${stars(r.rating)}  ${r.customerName}: ${clip(r.body)}`),
    ...(total > latest.length ? [``, `…and ${total - latest.length} more.`] : []),
    ``,
    `Open Product Reviews in your Wix dashboard to read and reply: ${manageUrl}`,
    ``,
    `You get this email once a day when new reviews arrive. Turn it off in the app's Settings.`,
  ].join("\n");

  const rows = latest
    .map(
      (r) => `<tr><td style="padding:10px 28px 0;font-size:15px;line-height:1.5;color:#34414e">
  <span style="color:#f5a623;letter-spacing:1px">${stars(r.rating)}</span> <strong>${esc(r.customerName)}</strong>${
        r.status === "PENDING" ? ` <span style="color:#8a5a00;font-size:13px">(waiting)</span>` : ""
      }<br>${esc(clip(r.body))}
</td></tr>`,
    )
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2933">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e1e5ea;border-radius:12px">
        <tr><td style="padding:28px 28px 8px;font-size:14px;color:#5f6b78">Product Reviews · ${esc(storeName)}</td></tr>
        <tr><td style="padding:0 28px;font-size:22px;line-height:1.3;font-weight:650">${esc(subject)}</td></tr>
        <tr><td style="padding:8px 28px 4px;font-size:15px;color:#34414e">${esc(waiting)}</td></tr>
${rows}
        ${total > latest.length ? `<tr><td style="padding:10px 28px 0;font-size:14px;color:#5f6b78">…and ${total - latest.length} more.</td></tr>` : ""}
        <tr><td style="padding:24px 28px 8px">
          <a href="${esc(manageUrl)}" style="display:inline-block;background:#1f2933;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:8px">Open your Wix dashboard</a>
        </td></tr>
        <tr><td style="padding:12px 28px 28px;font-size:13px;line-height:1.5;color:#5f6b78">
          You get this email once a day when new reviews arrive. Turn it off in the app's Settings.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

/** Owner email we can actually send to (install falls back to a placeholder). */
export function digestAddress(ownerEmail: string): string | null {
  const e = ownerEmail.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.toLowerCase().endsWith("@example.com")) return null;
  return e;
}
