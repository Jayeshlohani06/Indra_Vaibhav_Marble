import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // A production build without the API URL would point every browser at
  // localhost, so fail the build instead of shipping a broken site.
  if (command === 'build') {
    // loadEnv also picks up VITE_ variables set in the host environment.
    const env = loadEnv(mode, '.', 'VITE_')
    if (!env.VITE_API_BASE_URL) {
      throw new Error(
        'VITE_API_BASE_URL is not set. Set it to the backend URL before building.'
      )
    }
  }

  return {
    plugins: [
      react(),
      // Lets staff install the site on their phone like an app. Only the app's
      // own files are cached; API data (stock, cash, bills) always comes live
      // from the server so nobody sees old figures.
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
        manifest: {
          name: 'Indra Vaibhav Marble',
          short_name: 'Indra Vaibhav',
          description: 'Indra Vaibhav Marble business management system',
          lang: 'en',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          theme_color: '#2b251e',
          background_color: '#0B203A',
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,jpg,woff2}'],
          navigateFallback: '/index.html',
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              urlPattern: ({ url }) =>
                url.origin === 'https://fonts.googleapis.com' ||
                url.origin === 'https://fonts.gstatic.com',
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'google-fonts' },
            },
          ],
        },
      }),
    ],
  }
})
