import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use webpack for production builds to avoid Turbopack font resolution issues
  // Turbopack is still used in dev via `next dev --turbopack`
  bundlePagesRouterDependencies: true,
};

export default nextConfig;
