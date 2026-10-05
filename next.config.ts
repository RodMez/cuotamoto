import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    serverComponentsHmrCache: false,
  },
};

export default nextConfig;
