import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// `--mode native` builds the bundle that Capacitor wraps into the Android app:
// relative asset paths and no service worker (the files are already on the device).
export default defineConfig(({ mode }) => {
  const native = mode === 'native';
  return {
    base: native ? './' : '/',
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 1000 },
    plugins: [
      react(),
      VitePWA({
        disable: native,
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
          navigateFallback: 'index.html',
          cleanupOutdatedCaches: true,
        },
        manifest: {
          id: '/',
          name: 'Subscription Payments',
          short_name: 'Subscriptions',
          description: 'Track subscriptions, renewal dates and logins. Everything stays on your device.',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'any',
          background_color: '#EBE3D3',
          theme_color: '#EBE3D3',
          categories: ['finance', 'productivity', 'utilities'],
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
          shortcuts: [{ name: 'Add subscription', url: '/#/new' }],
        },
      }),
    ],
    test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  };
});
