import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bundles only the production node_modules subset the app actually needs
  // into .next/standalone — the Docker image copies that instead of the
  // full node_modules tree. Only applied outside Vercel: Vercel sets the
  // VERCEL env var during its own builds and has its own optimized output
  // format that "standalone" conflicts with (it goes looking for a
  // next-server.js.nft.json trace file that standalone mode doesn't
  // produce the way Vercel's build pipeline expects, and the build fails).
  // No effect on `next dev`/`next start` locally either way.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
};

export default nextConfig;
