import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: /(?:auth-login|navigation|permissions|screen15|screen16|screen17|screen18)\.spec\.mjs/,
  workers: 2, timeout: 30000,
  outputDir: 'tmp/regression-results',
  reporter: [['list'], ['json', { outputFile: 'tmp/regression-results.json' }]],
  use: { baseURL: 'http://localhost:5173', channel: 'msedge', headless: true, viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure' },
  webServer: { command: 'npm run dev -- --host localhost --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: true },
});
