import { defineConfig, devices } from "@playwright/test";

// Browser tests run against the committed production export (dist/) served by `vite preview`.
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "platform.spec.ts",
  timeout: 45_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 2,
  outputDir: "../test/scratch/platform-browser",
  reporter: [["list"], ["json", { outputFile: process.env.W1_E2E_REPORT ?? "../docs/validation/platform-ux-v1/e2e.json" }]],
  use: { baseURL: "http://127.0.0.1:4175/preview/", trace: "off", screenshot: "off" },
  webServer: {
    command: "node scripts/static-preview.mjs",
    url: "http://127.0.0.1:4175/preview/",
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, launchOptions: { executablePath: process.env.W1_CHROMIUM_EXECUTABLE } } },
    { name: "chromium-mobile", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, launchOptions: { executablePath: process.env.W1_CHROMIUM_EXECUTABLE } } },
    { name: "chromium-narrow", use: { ...devices["Desktop Chrome"], viewport: { width: 320, height: 844 }, launchOptions: { executablePath: process.env.W1_CHROMIUM_EXECUTABLE } } },
    { name: "webkit-desktop", use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 }, launchOptions: { executablePath: process.env.W1_WEBKIT_EXECUTABLE } } },
    { name: "webkit-mobile", use: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, launchOptions: { executablePath: process.env.W1_WEBKIT_EXECUTABLE } } },
  ],
});
