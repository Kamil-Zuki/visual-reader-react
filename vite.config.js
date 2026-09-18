import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Use '/' for Tauri (Android/desktop) builds, '/visual-reader-react/' for GitHub Pages
const isTauri = !!process.env.TAURI_ENV

export default defineConfig({
  base: isTauri ? '/' : '/visual-reader-react/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        maximumFileSizeToCacheInBytes: 25 * 1024 * 1024
      },
      devOptions: {
        // Keep disabled — enabling this generates dev-dist/sw.js which causes git conflicts
        enabled: false
      },
      manifest: {
        name: 'Visual Reader',
        short_name: 'VisReader',
        description: 'Interactive Visual Reader for Technical Books',
        theme_color: '#0c0e14',
        background_color: '#0c0e14',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})
