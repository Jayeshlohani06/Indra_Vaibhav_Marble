import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

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
    plugins: [react()],
  }
})
