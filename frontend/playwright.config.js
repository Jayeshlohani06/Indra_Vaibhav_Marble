import { defineConfig, devices } from '@playwright/test'

// Browser tests for the phone layout and the installable app. They run the
// production build against recorded API answers (see e2e/support/app.js), so
// no backend or database is needed.
const PORT = 4173
const ORIGIN = `http://127.0.0.1:${PORT}`
const OUT_DIR = 'e2e/.dist'

const phone = (width, height) => ({
  ...devices['Pixel 7'],
  viewport: { width, height },
})

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Recording writes one shared file, so it runs one test at a time.
  workers: process.env.RECORD_API ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: ORIGIN,
    // The service worker would answer requests itself and hide them from
    // the recorded API.
    serviceWorkers: 'block',
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // A common iPhone width and a small Android width.
    { name: 'phone', testMatch: /phone\/.*\.spec\.js/, use: phone(390, 844) },
    { name: 'small-phone', testMatch: /phone\/.*\.spec\.js/, use: phone(360, 740) },
    {
      name: 'desktop',
      testMatch: /desktop\/.*\.spec\.js/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: `vite build --outDir ${OUT_DIR} --emptyOutDir && vite preview --outDir ${OUT_DIR} --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: ORIGIN,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    // Same origin as the page, so no cross-origin rules get in the way.
    env: { VITE_API_BASE_URL: `${ORIGIN}/mock-api` },
  },
})
