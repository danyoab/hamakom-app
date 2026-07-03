import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // site.webmanifest in public/ stays the single source of truth
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // City photos and cached map tiles: cache as they're used, not upfront
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/city-images/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'city-images',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: ({ url }) => url.hostname.endsWith('tile.openstreetmap.org'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
        navigateFallback: '/index.html',
      },
    }),
  ],
  server: {
    host: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('leaflet') || id.includes('react-leaflet')) return 'leaflet'
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('@sentry')) return 'sentry'
        },
      },
    },
  },
})
