import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  outputDir: "test-results/production",
  timeout: 90000,
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/production-report.json" }],
  ],
  use: { ...base.use, baseURL: "http://127.0.0.1:8084" },
  // Start `node scripts/preview-web.mjs` separately to keep the server lifecycle explicit.
  webServer: undefined,
});
