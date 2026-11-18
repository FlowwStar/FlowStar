import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    exclude: ['e2e/**', 'node_modules/**'],
    // Tests must live in __tests__/**/*.{test,spec}.{ts,tsx}.
    // Files placed elsewhere (e.g. components/, lib/) are not collected.
    include: ['__tests__/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      enabled: true,
      reporter: ['text', 'lcov'],
      include: ['hooks/**', 'lib/**', 'components/**', 'utils/**'],
      exclude: ['**/*.d.ts', '**/index.ts'],
      // Measured baseline (2026-11-18): statements 63.05%, branches 65.68%,
      // functions 60.83%, lines 63.40%. Keep a small regression buffer;
      // ratchet thresholds up as coverage improves.
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
      '@': path.resolve(__dirname, '.'),
    },
  },
})
