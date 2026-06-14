import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support — NeoReviewKit",
  description: "Get help with NeoReviewKit for Wix.",
};

const contactEmail = "chandra.prabhakar12@gmail.com";

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Support</h1>
          <p className="text-slate-400 text-sm mt-1">NeoReviewKit — help &amp; documentation</p>
        </div>

        {/* Contact */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-3">
          <h2 className="text-base font-semibold text-white">Contact Us</h2>
          <p className="text-slate-400 text-sm">
            Email us at{" "}
            <a href={`mailto:${contactEmail}`} className="text-sky-400 hover:underline font-medium">
              {contactEmail}
            </a>{" "}
            and we'll respond within 24 hours on business days.
          </p>
        </div>

        {/* FAQ */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-white">Frequently Asked Questions</h2>

          {FAQ.map((item, i) => (
            <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-2">
              <p className="text-white text-sm font-medium">{item.q}</p>
              <p className="text-slate-400 text-sm leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>

        {/* Getting started */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-white">Getting Started</h2>

          {STEPS.map((step, i) => (
            <div key={i} className="flex gap-4 items-start">
              <div className="w-7 h-7 rounded-full bg-sky-900 text-sky-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </div>
              <div>
                <p className="text-white text-sm font-medium">{step.title}</p>
                <p className="text-slate-400 text-sm">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-800 pt-6 text-slate-500 text-xs">
          Still stuck? Email us at{" "}
          <a href={`mailto:${contactEmail}`} className="text-sky-400 hover:underline">{contactEmail}</a>
        </div>
      </div>
    </div>
  );
}

const FAQ = [
  {
    q: "When does a review request get sent to my customer?",
    a: "We send a review request email 14 days after the order is marked as fulfilled in your Wix store. This gives customers time to receive and use the product before reviewing.",
  },
  {
    q: "Do reviews go live immediately after a customer submits them?",
    a: "No — new reviews arrive in your Moderation queue with PENDING status. Go to Moderation in the app dashboard and click Approve to publish a review to your store.",
  },
  {
    q: "Where do approved reviews appear on my store?",
    a: "Once approved, reviews are served via our widget API and displayed on the relevant product page. You'll need to add the NeoReviewKit widget to your product pages in the Wix Editor.",
  },
  {
    q: "Can I reply to a customer's review?",
    a: "Yes — in the Moderation queue, click Reply next to any review, type your response, then click Approve + Reply. Your reply appears below the review on your storefront.",
  },
  {
    q: "What happens if a review contains spam or inappropriate content?",
    a: "Our system automatically flags suspicious content. Flagged reviews appear in your Moderation queue with warning labels so you can review them before approving.",
  },
  {
    q: "How do I upgrade my plan?",
    a: "Go to Billing in the app dashboard to see available plans. Upgrades are processed immediately through Wix Billing.",
  },
  {
    q: "How do I uninstall the app?",
    a: "Uninstall through the Wix App Market in your Wix dashboard. Your data is retained for 30 days and then permanently deleted.",
  },
];

const STEPS = [
  {
    title: "Install the app",
    desc: "Add NeoReviewKit from the Wix App Market to your store.",
  },
  {
    title: "Add the widget to your product pages",
    desc: "Open the Wix Editor, go to a product page, and add the NeoReviewKit widget from the Add panel.",
  },
  {
    title: "Wait for review requests to go out",
    desc: "Review request emails are sent automatically 14 days after each order is fulfilled. No action needed.",
  },
  {
    title: "Moderate incoming reviews",
    desc: "New reviews appear in your Moderation dashboard. Approve the ones you want published on your store.",
  },
  {
    title: "Watch your social proof grow",
    desc: "Approved reviews appear on your product pages and help boost conversions.",
  },
];
