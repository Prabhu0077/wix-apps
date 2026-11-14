"use client";

// Review policy text the merchant can paste on their site (PRD R12, T10.1).
// It describes how this app actually behaves, so it stays true: every rating
// is treated the same, verified-buyer labels, incentives disclosed, replies,
// removal only for listed reasons.

import { useState } from "react";

export function policyText(store: string): string {
  return `Customer review policy

${store} asks every customer for a review after their order is fulfilled. We send the same request whatever we expect the review to say.

Which reviews we publish
We publish positive and negative reviews alike. We don't publish a review only if it is offensive, contains personal information, is about something other than the product (for example, shipping by a third party), is spam or advertising, or appears to be fake. We never edit what a customer wrote.

Verified buyers
"Verified buyer" means the review was written through a link sent to a customer after a real order on this store. Reviews we imported from another system are labelled "Imported review".

Incentives
If a customer received anything for writing a review, such as a discount code, the review is labelled "Received an incentive for this review". The incentive never depends on the rating.

Replies
We may reply to reviews in public. Replies are shown under the review.

Questions
If you think a review breaks this policy, or you want your own review removed, contact us.`;
}

export function PolicyCard({ store }: { store: string }) {
  const [copied, setCopied] = useState(false);
  const text = policyText(store);

  return (
    <section className="card" aria-labelledby="policy-title">
      <div className="card-head">
        <div>
          <h2 className="card-title" id="policy-title">
            Review policy for your site
          </h2>
          <p className="card-sub">
            Shoppers and regulators trust reviews more when you explain how you collect them. Copy this onto a page of your
            site (for example, your FAQ) and adjust it if you need to.
          </p>
        </div>
      </div>
      <div className="card-body stack-sm">
        <textarea className="textarea policy-text" readOnly value={text} aria-label="Review policy text" rows={12} />
        <div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "Copied" : "Copy policy text"}
          </button>
        </div>
      </div>
    </section>
  );
}
