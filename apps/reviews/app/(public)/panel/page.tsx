import type { Metadata } from "next";

import { PRODUCT_NAME } from "@/lib/product";

export const metadata: Metadata = { title: `${PRODUCT_NAME} settings` };

// Settings panel the Wix Editor opens from the plugin's action bar. Wix
// requires a panel URL for every site plugin; all settings live in the app
// dashboard, so this panel only says where to find them.
export default function EditorPanel() {
  return (
    <main style={{ padding: 20, fontFamily: "system-ui, sans-serif", fontSize: 14, lineHeight: 1.5 }}>
      <h1 style={{ fontSize: 16, margin: "0 0 8px" }}>{PRODUCT_NAME}</h1>
      <p style={{ margin: "0 0 8px" }}>
        The reviews section takes its look from your store. Review emails, publishing and replies are set in the app
        dashboard.
      </p>
      <p style={{ margin: 0 }}>
        In your Wix dashboard, open <strong>Apps</strong> and choose <strong>{PRODUCT_NAME}</strong>, then{" "}
        <strong>Settings</strong>.
      </p>
    </main>
  );
}
