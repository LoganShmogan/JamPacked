import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    include: ["tests/**/*.test.ts"],
    server: { deps: { inline: ["convex-test"] } },
    coverage: {
      provider: "v8",
      include: ["convex/**/*.ts"],
      // seed.ts is test-data tooling: tests/seed.test.ts runs it end to end, but which branches its
      // simulated days take is down to its random numbers, so it's left out of the 100% gate.
      exclude: ["convex/_generated/**", "convex/seed.ts"],
      reporter: ["text", "html", "lcov"],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
