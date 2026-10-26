import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: 'screen17.spec.mjs',
  workers: 1,
  timeout: 30000,
  outputDir: 'tmp/screen17-results',
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
