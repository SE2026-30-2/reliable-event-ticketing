import { defineConfig } from '@playwright/test';

// Use the origin allowed by the local backend's CORS configuration.
export default defineConfig({
  testDir: './tests',
  testMatch: 'auth-login.spec.mjs',
  workers: 1,
  timeout: 30000,
  outputDir: 'tmp/auth-results',
  use: {
    baseURL: 'http://localhost:5173',
    channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
    headless: true,
  },
  webServer: {
    command: 'npm run dev -- --host localhost --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
