import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    exclude: ['e2e/**', 'node_modules/**'],
    include: ['__tests__/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['hooks/**', 'lib/**', 'components/**'],
      exclude: ['**/*.d.ts', '**/index.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
