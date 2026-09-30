import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Base path:
// Default to '/' for Tauri (desktop/android) and local dev.
// Only use '/visual-reader-react/' if GITHUB_PAGES env variable is explicitly set.
const isGithubPages = process.env.GITHUB_PAGES === 'true'
const enablePwa = isGithubPages || process.env.ENABLE_PWA === 'true'

export default defineConfig({
  base: isGithubPages ? '/visual-reader-react/' : '/',
  build: {
    // epubjs + mermaid + react — один крупный чанк для Tauri ожидаем
    chunkSizeWarningLimit: 1800,
  },
  plugins: [
    react(),
    ...(enablePwa ? [
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
    ] : [])
  ]
})
