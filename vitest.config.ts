/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['**/*.test.{ts,tsx}'],
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    css: false,
    alias: {
      '@': resolve(__dirname, './src'),
    },
    mockReset: false,
    clearMocks: false,
    restoreMocks: false,
    deps: {
      optimizer: {
        web: {
          include: ['vitest']
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '\\.(css|less|scss|sass)$': resolve(__dirname, './src/tests/__mocks__/styleMock.json')
    },
  },
})
