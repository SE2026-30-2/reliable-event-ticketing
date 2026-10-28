import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests', testMatch: 'permissions.spec.mjs', workers: 1,
  outputDir: 'tmp/permissions-results',
  use: { baseURL: 'http://localhost:5175', channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true },
  webServer: { command: 'npm run dev -- --host localhost --port 5175 --strictPort --force', url: 'http://localhost:5175', reuseExistingServer: false },
});
