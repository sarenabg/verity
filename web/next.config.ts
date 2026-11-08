import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  // Lets a production build run in a separate folder while the dev server keeps using .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // This folder is the app's root, even if a parent folder has its own lockfile.
  outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),
};

export default nextConfig;
