// Email template for the review request email sent to customers.
// Uses Resend's React email rendering.

import * as React from "react";

interface ReviewRequestEmailProps {
  customerName: string;
  products: { id: string; name: string }[];
  reviewUrl: string;
  storeName: string;
}

export function ReviewRequestEmail({
  customerName,
  products,
  reviewUrl,
  storeName,
}: ReviewRequestEmailProps) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>How was your order?</title>
      </head>
      <body style={{ fontFamily: "Arial, sans-serif", color: "#333", margin: 0, padding: 0, backgroundColor: "#f9f9f9" }}>
        <div style={{ maxWidth: 600, margin: "40px auto", backgroundColor: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
          <div style={{ backgroundColor: "#1a1a2e", padding: "32px 40px", textAlign: "center" as const }}>
            <h1 style={{ color: "#fff", margin: 0, fontSize: 24 }}>{storeName}</h1>
          </div>
          <div style={{ padding: "40px 40px 24px" }}>
            <h2 style={{ fontSize: 22, marginTop: 0 }}>
              Hi {customerName}, how was your order?
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.6, color: "#555" }}>
              We hope you&apos;re enjoying your recent purchase! We&apos;d love to hear what you think.
              Your review helps other shoppers and helps us improve.
            </p>
            {products.length > 0 && (
              <>
                <p style={{ fontSize: 14, color: "#888", marginBottom: 8 }}>Items in your order:</p>
                <ul style={{ paddingLeft: 20, marginBottom: 24 }}>
                  {products.map((p) => (
                    <li key={p.id} style={{ fontSize: 15, lineHeight: 1.8, color: "#444" }}>
                      {p.name}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div style={{ textAlign: "center" as const, margin: "32px 0" }}>
              <a
                href={reviewUrl}
                style={{
                  display: "inline-block",
                  backgroundColor: "#4f46e5",
                  color: "#fff",
                  padding: "14px 32px",
                  borderRadius: 6,
                  fontSize: 16,
                  fontWeight: "bold",
                  textDecoration: "none",
                }}
              >
                Write a Review
              </a>
            </div>
            <p style={{ fontSize: 13, color: "#aaa", textAlign: "center" as const }}>
              This link is personal to you and expires in 30 days.
            </p>
          </div>
          <div style={{ backgroundColor: "#f3f3f3", padding: "20px 40px", textAlign: "center" as const }}>
            <p style={{ fontSize: 12, color: "#aaa", margin: 0 }}>
              © {new Date().getFullYear()} {storeName}. You received this because you placed an order.
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
