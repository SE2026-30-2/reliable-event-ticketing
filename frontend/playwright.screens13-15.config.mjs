import { defineConfig } from '@playwright/test';
const port = Number(process.env.SCREENS_TEST_PORT || 5182);
export default defineConfig({
  testDir: './tests', testMatch: /screen(?:14|15)\.spec\.mjs/, workers: 2, timeout: 45000,
  outputDir: 'tmp/screens13-15-results', reporter: [['list'], ['json', { outputFile: 'tmp/screens13-15-results.json' }]],
  use: { baseURL: `http://127.0.0.1:${port}`, channel: 'msedge', headless: true, viewport: { width: 1440, height: 1050 }, screenshot: 'only-on-failure' },
  webServer: { command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port} --strictPort`, url: `http://127.0.0.1:${port}`, reuseExistingServer: true, timeout: 30000 },
});
