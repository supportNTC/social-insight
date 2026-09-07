import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Dev is served through the portless proxy (https://social-insight.localhost:3443),
  // which is a different origin than the localhost port Next binds to.
  // Available on Next 15.2+.
  allowedDevOrigins: ["social-insight.localhost"],
  typescript: {
    // Never let a broken build ship silently — `pnpm typecheck` is also run in CI.
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
