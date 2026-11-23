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
      // Last measured 2026-11-18: 63.05% statements, 65.68% branches,
      // 60.83% functions, 63.40% lines. The suite had baseline failures;
      // verify these values against a fully passing run before raising again.
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
