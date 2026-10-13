// Dashboard fonts: Wix Madefor (OFL, on Google Fonts) so the app reads as
// native inside the Wix dashboard. The storefront widget does not use these.

import { Wix_Madefor_Display, Wix_Madefor_Text } from "next/font/google";

export const displayFont = Wix_Madefor_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--nf-display",
  display: "swap",
});

export const textFont = Wix_Madefor_Text({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--nf-text",
  display: "swap",
});

export const fontVariables = `${displayFont.variable} ${textFont.variable}`;
