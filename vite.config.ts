/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the app from /<repo>/, so the base is configurable.
const base = process.env.BASE_PATH ?? '/';

import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    preact(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/*.svg', 'icons/*.png'],
      manifest: {
        id: 'ingenious-grid-rush',
        name: 'InGenious Grid Rush',
        short_name: 'Grid Rush',
        description: 'Zgradi energetski nadzorni center, lovi konice, reši hladno verigo in prebudi Temni števec. Šest regij, sedem mini iger, filmska zgodba.',
        lang: 'sl',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#070b1a',
        theme_color: '#070b1a',
        categories: ['games', 'education'],
        screenshots: [
          { src: 'screenshots/1-naslov.jpg', sizes: '780x1688', type: 'image/jpeg', form_factor: 'narrow', label: 'Naslovni zaslon' },
          { src: 'screenshots/2-zemljevid.jpg', sizes: '780x1688', type: 'image/jpeg', form_factor: 'narrow', label: 'Zemljevid šestih regij' },
          { src: 'screenshots/3-finale.jpg', sizes: '780x1688', type: 'image/jpeg', form_factor: 'narrow', label: 'Filmski prizor: finale' },
          { src: 'screenshots/4-alarm.jpg', sizes: '780x1688', type: 'image/jpeg', form_factor: 'narrow', label: 'Mini igra Alarm!' },
        ],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // Story voices load on demand and stay cached for offline replays.
        runtimeCaching: [
          {
            urlPattern: /\/voice\/.*\.mp3$/,
            handler: 'CacheFirst',
            options: { cacheName: 'voice', expiration: { maxEntries: 400 } },
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
