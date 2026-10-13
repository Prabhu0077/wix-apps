import type { Metadata } from "next";

import { MAKER_LOCATION, MAKER_NAME, MAKER_URL, PRODUCT_NAME, SUPPORT_EMAIL } from "@/lib/product";

export const metadata: Metadata = {
  title: `Terms of use — ${PRODUCT_NAME}`,
  description: `Terms for store owners who use ${PRODUCT_NAME} on Wix.`,
};

// Plain-language terms for store owners (task T10.3). Review with a lawyer
// before App Market submission, alongside the privacy policy.
const LAST_UPDATED = "13 October 2026";

export default function TermsPage() {
  return (
    <main className="doc">
      <h1>Terms of use</h1>
      <p className="doc-meta">
        {PRODUCT_NAME} for Wix. Last updated {LAST_UPDATED}.
      </p>

      <h2>Who these terms are between</h2>
      <p>
        These terms are between you, the owner of the Wix store that installs {PRODUCT_NAME}, and {MAKER_NAME}, a registered
        micro enterprise (MSME) in {MAKER_LOCATION}. By installing the app you accept them. Wix&apos;s own terms also apply to
        your use of the Wix App Market.
      </p>

      <h2>What the app does</h2>
      <p>
        The app emails your customers after an order is fulfilled to ask for a review, collects the reviews, lets you
        publish, hide or reply to them, and shows published reviews on your product pages.
      </p>

      <h2>Plans and billing</h2>
      <ul>
        <li>The Free plan stays free. Paid plans are bought, renewed and cancelled through Wix, which bills you.</li>
        <li>Each plan includes a number of review requests a month. When you reach it, new orders aren&apos;t asked for a
          review until the next month or until you upgrade. Your reviews are never hidden because of a plan limit.</li>
        <li>Refunds follow Wix&apos;s App Market refund rules.</li>
      </ul>

      <h2>Your responsibilities</h2>
      <ul>
        <li>Have the right to email your customers about their orders, and keep your business address up to date in Wix
          (it appears in every review email).</li>
        <li>Don&apos;t publish only positive reviews, write or buy fake reviews, or offer rewards that depend on the rating.
          These practices are illegal in many countries, including under the US FTC rule on consumer reviews and the UK
          Digital Markets, Competition and Consumers Act.</li>
        <li>If you give customers anything for a review, say so; the app labels such reviews.</li>
        <li>Respond to customers who ask you to remove or correct their review.</li>
      </ul>

      <h2>Your data</h2>
      <p>
        Your reviews and customer data belong to you. You can export all of them at any time, on every plan, from the
        Reviews tab. When you uninstall the app, we delete your data within 30 days. See the{" "}
        <a href="/privacy">privacy policy</a> for details.
      </p>

      <h2>Availability and changes</h2>
      <p>
        We work to keep the app running and fix problems quickly, but we can&apos;t promise it will never be interrupted.
        We may change features; we&apos;ll tell you by email before any change that removes something you pay for.
      </p>

      <h2>Liability</h2>
      <p>
        The app is provided as it is. To the extent the law allows, {MAKER_NAME}&apos;s total liability to you is limited to
        what you paid for the app in the 12 months before the claim. Nothing in these terms limits liability that the law
        does not allow us to limit.
      </p>

      <h2>Ending</h2>
      <p>You can stop at any time by uninstalling the app. We may suspend accounts that break these terms or the law.</p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>

      <p className="doc-foot">
        <a href={MAKER_URL}>{MAKER_NAME}</a>, {MAKER_LOCATION}. <a href="/privacy">Privacy</a> · <a href="/support">Help</a>
      </p>
    </main>
  );
}
