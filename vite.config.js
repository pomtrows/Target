import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-icon.png', 'images/**/*', 'sound/**/*'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,mp3,wav,webmanifest}'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 150,
                maxAgeSeconds: 60 * 24 * 60 * 60 // 60 days
              }
            }
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/images/sport/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'sport-illustrations',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 90 * 24 * 60 * 60 // 90 days
              }
            }
          }
        ]
      },
      manifest: {
        name: 'Target - Vos Objectifs',
        short_name: 'Target',
        description: 'Suivi d\'objectifs hebdomadaires gamifié',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-icon.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-icon.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-icon.png',
            sizes: '1024x1024',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('framer-motion') || id.includes('lucide-react')) {
              return 'ui';
            }
            if (id.includes('@supabase')) {
              return 'supabase';
            }
            if (id.includes('date-fns') || id.includes('canvas-confetti')) {
              return 'utils';
            }
            return 'vendor';
          }
        }
      }
    }
  }
})
