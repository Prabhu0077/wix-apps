import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Visual UGC Reviews",
  description: "Photo and video reviews for Wix Stores.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", minHeight: "100vh" }}>
          <nav style={{ padding: 16, borderRight: "1px solid #e5e7eb", background: "#fafafa" }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: "#1f3864" }}>
              Visual UGC Reviews
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 14 }}>
              <li style={{ marginBottom: 8 }}><a href="/">Overview</a></li>
              <li style={{ marginBottom: 8 }}><a href="/reviews">Moderation</a></li>
              <li style={{ marginBottom: 8 }}><a href="/settings">Settings</a></li>
              <li style={{ marginBottom: 8 }}><a href="/billing">Billing</a></li>
            </ul>
          </nav>
          <main style={{ padding: 24 }}>{children}</main>
        </div>
      </body>
    </html>
  );
}
