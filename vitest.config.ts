import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@shared': resolve(__dirname, './src/shared'),
    },
  },
})
