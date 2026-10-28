import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

// Builds the app icons (home screen, Android maskable, Apple touch) from the
// logo. Run `npm run icons` after changing public/favicon.svg.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: "#0B203A" } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: "#0B203A" } },
  },
  images: ["public/favicon.svg"],
});
