import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // A stray ~/package-lock.json otherwise makes Next guess the wrong workspace root.
  turbopack: { root: path.resolve(__dirname) },
  outputFileTracingRoot: path.resolve(__dirname),
  // Library guides + verification overlays are read from disk at request time.
  outputFileTracingIncludes: { "/**": ["./data/**/*.json"] },
};

export default nextConfig;
