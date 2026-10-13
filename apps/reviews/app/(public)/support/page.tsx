import type { Metadata } from "next";

import { ProductIcon } from "@/components/ui/ProductIcon";
import { MAKER_NAME, MAKER_URL, PRODUCT_NAME, REVIEW_LINK_DAYS, SUPPORT_EMAIL } from "@/lib/product";

export const metadata: Metadata = {
  title: `Help — ${PRODUCT_NAME} for Wix`,
  description: `How to set up and use ${PRODUCT_NAME} on your Wix store.`,
};

const STEPS = [
  { title: "Add the app to your site", text: "Install it from the Wix App Market and open it from your Wix dashboard." },
  {
    title: "Place the reviews section on your product page",
    text: "In the Wix Editor, open a product page, add the reviews section from the app's panel and publish your site.",
  },
  {
    title: "Fulfil orders as usual",
    text: "When you mark an order as fulfilled, we schedule a review request email for that customer.",
  },
  {
    title: "Publish the reviews you receive",
    text: "New reviews wait in the Reviews tab. Publish them, hide them later or reply in public.",
  },
];

const FAQ = [
  {
    q: "When is the review request email sent?",
    a: "14 days after the order is marked as fulfilled, unless you change the delay in Settings. You can choose 1 to 60 days.",
  },
  {
    q: "Do reviews go live straight away?",
    a: "Only if you turn on automatic publishing in Settings. Otherwise each review waits for you in the Reviews tab.",
  },
  {
    q: "Can I publish only good reviews?",
    a: "No. Automatic publishing treats every rating the same way. Holding back low ratings misleads shoppers and breaks consumer-protection rules in the US, UK and EU, and Google can remove your review stars for it.",
  },
  {
    q: "What does \"Verified buyer\" mean?",
    a: "The review came through a request email linked to a real order on your Wix store.",
  },
  {
    q: "How long does a review link work?",
    a: `${REVIEW_LINK_DAYS} days after the email is sent.`,
  },
  {
    q: "What happens to my reviews if I change plans?",
    a: "Your reviews stay on your store whatever plan you're on. We warn you in the app at 80% of your monthly requests; at the limit, new orders aren't asked for a review until next month or until you upgrade.",
  },
  {
    q: "How do I uninstall?",
    a: "Remove the app from your Wix dashboard. Review emails stop straight away and your data is deleted within 30 days. Export your reviews from the Reviews tab first if you want to keep a copy. Reinstalling within 30 days brings everything back.",
  },
  {
    q: "Can I export my reviews?",
    a: "Yes, on every plan. In the Reviews tab, choose \"Export all reviews (CSV)\". The file opens in Excel or Google Sheets.",
  },
  {
    q: "Can I bring reviews from another app?",
    a: "Yes. Export them as a CSV from the other app, then use \"Import reviews\" in the Reviews tab. Imported reviews are labelled \"Imported review\".",
  },
  {
    q: "Can customers stop the emails?",
    a: "Yes. Every email has an unsubscribe link, and after that your store won't send that customer review requests again.",
  },
];

export default function SupportPage() {
  return (
    <main className="doc">
      <div className="doc-head">
        <ProductIcon size={40} />
        <div>
          <h1>{PRODUCT_NAME} help</h1>
          <p className="doc-meta">For Wix stores</p>
        </div>
      </div>

      <p>
        Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with your site address and a short description.
        We reply within one working day (Monday to Saturday, India time).
      </p>

      <h2>Getting started</h2>
      <ol>
        {STEPS.map((s) => (
          <li key={s.title}>
            <strong>{s.title}.</strong> {s.text}
          </li>
        ))}
      </ol>

      <h2>Common questions</h2>
      <dl className="faq">
        {FAQ.map((f) => (
          <div key={f.q}>
            <dt>{f.q}</dt>
            <dd>{f.a}</dd>
          </div>
        ))}
      </dl>

      <p className="doc-foot">
        {PRODUCT_NAME} is made by <a href={MAKER_URL}>{MAKER_NAME}</a>. <a href="/privacy">Privacy policy</a> ·{" "}
        <a href="/terms">Terms of use</a>
      </p>
    </main>
  );
}
