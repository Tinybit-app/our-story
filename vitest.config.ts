import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '~': resolve(__dirname, 'app'),
      '@': resolve(__dirname, 'app'),
    },
  },
  test: {
    exclude: [
      'tests/**', // Playwright e2e tests
      '**/node_modules/**',
    ],
  },
})
