import { defineConfig, devices } from '@playwright/test'

// Las pruebas de extremo a extremo necesitan el stack local levantado (ver tests/e2e/support.ts).
// Los proyectos 'desktop' y 'mobile' usan el servidor de desarrollo; 'pwa' usa la compilación de
// producción, porque el service worker solo existe ahí.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /(pwa-.*|responsive)\.spec\.ts/,
    },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /(responsive|a11y)\.spec\.ts/ },
    {
      name: 'pwa',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:4173',
        serviceWorkers: 'allow',
      },
      testMatch: /pwa-.*\.spec\.ts/,
    },
  ],
  webServer: [
    { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true },
    {
      command: 'npm run build && npm run preview -- --port 4173 --strictPort',
      url: 'http://localhost:4173',
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
})
