import type { Metadata } from "next";

import "../styles/dashboard.css";
import { DashboardFrame } from "@/components/dashboard/DashboardFrame";
import { fontVariables } from "@/lib/fonts";
import { PRODUCT_NAME } from "@/lib/product";

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: "Collect, moderate and show verified product reviews on your Wix store.",
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body>
        <DashboardFrame>{children}</DashboardFrame>
      </body>
    </html>
  );
}
