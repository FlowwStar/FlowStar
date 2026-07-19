import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    exclude: ["e2e/**", "node_modules/**"],
    include: ["__tests__/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      enabled: true,
      reporter: ["text", "lcov"],
      include: ["hooks/**", "lib/**", "components/**"],
      exclude: ["**/*.d.ts", "**/index.ts"],
      // Baseline from current coverage (`npm run test:coverage` on 2026-07-18).
      // Ratchet these up over time as more tests are added; never lower them
      // to make a failing PR pass.
      thresholds: {
        statements: 13,
        branches: 60,
        functions: 40,
        lines: 13,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
