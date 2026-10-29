import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 60000,
  expect: { timeout: 20000 },
  use: {
    channel:
      process.env.PLAYWRIGHT_CHANNEL ||
      (process.platform === "win32" ? "msedge" : undefined),
    baseURL: "http://localhost:8082",
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
  },
  workers: 1,
  webServer: {
    command: "npm run web -- --port 8082",
    url: "http://localhost:8082",
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
  },
});
