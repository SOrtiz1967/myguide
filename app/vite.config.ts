import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    // La PWA no participa en las pruebas unitarias.
    mode !== 'test' &&
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'MyGuide',
          short_name: 'MyGuide',
          description: 'Seguimiento personal de alimentación, entrenamiento y bienestar.',
          lang: 'es',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          background_color: '#f4f6f8',
          theme_color: '#0b6e99',
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        // FR-019: solo se precachea la carcasa (HTML, JS, CSS, íconos). Ninguna llamada de datos se
        // intercepta ni se guarda: no hay modo sin conexión ni cola de sincronización.
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/functions\//, /^\/rest\//, /^\/auth\//, /^\/storage\//],
          runtimeCaching: [],
          cleanupOutdatedCaches: true,
        },
      }),
  ],
  server: {
    // Una prueba lee la migración de ejercicios (`?raw`) para comprobar que las listas cerradas coinciden;
    // solo esa carpeta, que no tiene secretos.
    fs: { allow: ['.', '../supabase/migrations'] },
  },
  test: {
    environment: 'jsdom',
    testTimeout: 15000,
    // Variables públicas de prueba: el cliente de Supabase valida el entorno al importarse.
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: 'anon-key-de-prueba',
      VITE_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
    },
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/component/**/*.test.{ts,tsx}'],
  },
}))
