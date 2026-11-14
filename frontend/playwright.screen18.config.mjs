import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests', testMatch: 'screen18.spec.mjs', workers: 1, timeout: 30000,
  outputDir: 'tmp/screen18-results',
  use: { baseURL: 'http://127.0.0.1:5185', channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5185 --strictPort', url: 'http://127.0.0.1:5185', reuseExistingServer: !process.env.CI },
});
