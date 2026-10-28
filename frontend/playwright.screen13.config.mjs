import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: 'screen13.spec.mjs', timeout: 45000, workers: 1,
  outputDir: 'tmp/screen13-results',
  use: { baseURL: 'http://127.0.0.1:5178', channel: 'msedge', headless: true, viewport: { width: 1440, height: 1050 } },
  webServer: { command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5178 --strictPort', url: 'http://127.0.0.1:5178', reuseExistingServer: false },
});
