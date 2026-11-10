import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/vite-env.d.ts'],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
        'src/domain/money.ts': {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
      },
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
    },
  },
})
