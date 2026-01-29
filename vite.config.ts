import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'RideShare.Click - Community Ride Sharing',
        short_name: 'RideShare.Click',
        description: 'Cooperative ride sharing platform for community-based transportation',
        theme_color: '#10b981',
        background_color: '#ffffff',
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
          }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.amazonaws\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'aws-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 300 // 5 minutes
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Cache OpenStreetMap tiles for better performance
            urlPattern: /^https:\/\/([a-c])\.tile\.openstreetmap\.org\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'osm-tiles-cache',
              expiration: {
                maxEntries: 1000, // Cache up to 1000 tiles
                maxAgeSeconds: 7 * 24 * 60 * 60 // 7 days (OSM tiles don't change often)
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
              // Use cache if network times out
              networkTimeoutSeconds: 3
            }
          }
        ]
      }
    })
  ],
  build: {
    target: 'baseline-widely-available', // Explicit default for Vite 7
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          amplify: ['aws-amplify', '@aws-amplify/ui-react'],
          map: ['leaflet', 'react-leaflet']
        }
      }
    }
  },
  optimizeDeps: {
    include: [
      'aws-amplify',
      '@aws-amplify/ui-react',
      'react',
      'react-dom',
      'maplibre-gl'
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['node_modules', 'dist', 'tests/**'],
  },
});
