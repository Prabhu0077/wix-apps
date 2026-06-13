import type { NextConfig } from "next";

/**
 * The dashboard renders inside a Wix iframe at manage.wix.com.
 * We must allow that origin to embed us; everything else stays blocked.
 */
const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors https://*.wix.com https://manage.wix.com",
          },
        ],
      },
    ];
  },
};

export default config;
