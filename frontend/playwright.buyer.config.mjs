import { defineConfig } from '@playwright/test';
const port = Number(process.env.BUYER_TEST_PORT || 5189);
export default defineConfig({
  testDir: './tests', testMatch: 'buyer-flow.spec.mjs', workers: 2, timeout: 30000,
  outputDir: 'tmp/buyer-results', reporter: [['list'], ['json', { outputFile: 'tmp/buyer-results.json' }]],
  use: { baseURL: `http://127.0.0.1:${port}`, channel: 'msedge', headless: true, viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure' },
  webServer: { command: `node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${port} --strictPort`, url: `http://127.0.0.1:${port}`, reuseExistingServer: Boolean(process.env.BUYER_REUSE_TEST_SERVER) },
});
