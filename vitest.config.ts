import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: [
      'tests/**',          // Playwright e2e tests
      '**/node_modules/**',
    ],
  },
})
