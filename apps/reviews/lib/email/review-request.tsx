// Review request email, sent on the store's behalf. It should read like a
// note from the store: store name first, one clear button, plain wording
// that doesn't steer the rating (FTC / UK DMCC: no sentiment-led asks).
// Every email carries a working unsubscribe link (CAN-SPAM, UK PECR); the
// sender also adds List-Unsubscribe headers for the mail app's own button.

import { REVIEW_LINK_DAYS } from "@/lib/product";

type Props = {
  storeName: string;
  productNames: string[];
  reviewUrl: string;
  unsubscribeUrl: string;
  /** Sender's postal address (CAN-SPAM). Null if the merchant hasn't set one in Wix Business Info. */
  storeAddress?: string | null;
  /** "reminder" = the one follow-up (Starter+), sent once if no review after 7 days. */
  kind?: "request" | "reminder";
  /** Thank-you coupon percent (Starter+), promised for ANY honest review. Null = no coupon. */
  couponPercent?: number | null;
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function renderReviewRequestEmail({
  storeName,
  productNames,
  reviewUrl,
  unsubscribeUrl,
  storeAddress,
  kind = "request",
  couponPercent = null,
}: Props) {
  const items =
    productNames.length === 1
      ? productNames[0]
      : productNames.length > 1
        ? `${productNames.slice(0, -1).join(", ")} and ${productNames[productNames.length - 1]}`
        : "your recent order";

  const reminder = kind === "reminder";
  const subject = reminder
    ? `A quick reminder from ${storeName}`
    : `How was your order from ${storeName}?`;
  const heading = reminder ? "Still happy to hear from you" : "How was your order?";
  const intro = reminder
    ? `A short reminder: we'd still value your honest review of`
    : `You recently received`;
  // Same wording for every rating: the coupon is for reviewing, not for praise.
  const coupon = couponPercent
    ? `As a thank-you, you'll get a ${couponPercent}% discount code for your next order after you send any honest review, good or bad.`
    : null;

  const text = [
    `Hi,`,
    ``,
    reminder
      ? `${intro} ${items} from ${storeName}. It helps other shoppers decide.`
      : `${intro} ${items} from ${storeName}. Would you share an honest review? It helps other shoppers decide.`,
    ``,
    ...(coupon ? [coupon, ``] : []),
    `Write a review: ${reviewUrl}`,
    ``,
    `This link works for ${REVIEW_LINK_DAYS} days. You got this email because you ordered from ${storeName}.`,
    `Don't want review requests from ${storeName}? Unsubscribe: ${unsubscribeUrl}`,
    ...(storeAddress ? [``, `${storeName}, ${storeAddress}`] : []),
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2933">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e1e5ea;border-radius:12px">
        <tr><td style="padding:28px 28px 8px;font-size:14px;color:#5f6b78">${esc(storeName)}</td></tr>
        <tr><td style="padding:0 28px;font-size:22px;line-height:1.3;font-weight:650">${esc(heading)}</td></tr>
        <tr><td style="padding:14px 28px 0;font-size:16px;line-height:1.6;color:#34414e">
          ${esc(intro)} <strong>${esc(items)}</strong>${
            reminder ? "." : ". Would you share an honest review?"
          } It helps other shoppers decide, and it takes about a minute.
        </td></tr>${
          coupon
            ? `
        <tr><td style="padding:14px 28px 0;font-size:15px;line-height:1.6;color:#34414e">${esc(coupon)}</td></tr>`
            : ""
        }
        <tr><td style="padding:24px 28px 8px">
          <a href="${esc(reviewUrl)}" style="display:inline-block;background:#1f2933;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:13px 24px;border-radius:8px">Write a review</a>
        </td></tr>
        <tr><td style="padding:12px 28px 28px;font-size:13px;line-height:1.5;color:#5f6b78">
          This link works for ${REVIEW_LINK_DAYS} days. You got this email because you ordered from ${esc(storeName)}.<br>
          Don't want review requests from ${esc(storeName)}? <a href="${esc(unsubscribeUrl)}" style="color:#5f6b78">Unsubscribe</a>${
            storeAddress ? `<br><br>${esc(storeName)}, ${esc(storeAddress)}` : ""
          }
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}
