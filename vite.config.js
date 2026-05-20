import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
