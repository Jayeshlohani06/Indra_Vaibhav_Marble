import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Unit tests run in a simulated browser (jsdom). The phone layout tests in
// e2e/ run in a real browser through Playwright instead.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
    setupFiles: ['./src/test/setup.js'],
    restoreMocks: true,
    unstubGlobals: true,
  },
})
