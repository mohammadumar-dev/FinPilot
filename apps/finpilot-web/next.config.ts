import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bundles only the production node_modules subset the app actually needs
  // into .next/standalone — the Docker image copies that instead of the
  // full node_modules tree. No effect on `next dev`/`next start` locally.
  output: "standalone",
};

export default nextConfig;
