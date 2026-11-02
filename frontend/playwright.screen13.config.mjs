import { defineConfig } from '@playwright/test';
const port = Number(process.env.CHECKIN_TEST_PORT || 5178);
export default defineConfig({
  testDir: './tests', testMatch: 'screen13.spec.mjs', timeout: 45000, workers: 1,
  outputDir: 'tmp/screen13-results',
  use: { baseURL: `http://127.0.0.1:${port}`, channel: 'msedge', headless: true, viewport: { width: 1440, height: 1050 } },
  webServer: { command: `node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${port} --strictPort`, url: `http://127.0.0.1:${port}`, reuseExistingServer: Boolean(process.env.CHECKIN_REUSE_TEST_SERVER) },
});
