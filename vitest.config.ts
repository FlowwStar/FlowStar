import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    exclude: ["e2e/**", "node_modules/**"],
    // Tests must live in __tests__/**/*.{test,spec}.{ts,tsx}.
    // Files placed elsewhere (e.g. components/, lib/) are not collected.
    include: ["__tests__/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      enabled: true,
      reporter: ["text", "lcov"],
      include: ["hooks/**", "lib/**", "components/**", "utils/**"],
      exclude: ["**/*.d.ts", "**/index.ts"],
      // Measured 2026-11-23: 67.53% statements, 67.51% branches,
      // 66.05% functions, 67.90% lines (reportOnFailure). Main's test suite
      // still fails, so revalidate on a fully passing suite before raising.
      thresholds: {
        statements: 60,
        branches: 62,
        functions: 57,
        lines: 60,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
