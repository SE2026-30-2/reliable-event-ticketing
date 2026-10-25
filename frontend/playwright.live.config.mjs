import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests', testMatch: 'live-backend.spec.mjs', workers: 1, timeout: 45000,
  globalTeardown: './tests/live-cleanup.mjs',
  outputDir: 'tmp/live-results',
  reporter: [['list'], ['json', { outputFile: 'tmp/live-results.json' }]],
  use: { baseURL: 'http://localhost:5173', channel: 'msedge', headless: true, viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure' },
  webServer: { command: 'npm run dev -- --host localhost --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: true },
});
