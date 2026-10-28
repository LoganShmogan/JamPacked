import type { NextConfig } from "next";

// A static site (`out/`): the pages are the same for everyone, and /admin fetches its data in the
// browser. It can be served by nginx on loganserver now and by Vercel later, unchanged.
const nextConfig: NextConfig = {
  output: "export",
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
