import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Server Actions handle large file bodies for statement uploads.
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
