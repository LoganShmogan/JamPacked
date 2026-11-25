import type { NextConfig } from "next";

// A static site (`out/`): the pages are the same for everyone, and /admin fetches its data in the
// browser. Served by Cloudflare Pages (deploy/deploy.sh).
const nextConfig: NextConfig = {
  output: "export",
  basePath: process.env.BASE_PATH || undefined, // e.g. /mockup, to host a preview build under a sub-path
  trailingSlash: true,
  images: { unoptimized: true },
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
