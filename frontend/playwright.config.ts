import { defineConfig, devices } from "@playwright/test";

// Browser tests run against the committed production export (dist/) served by `vite preview`.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45_000,
  retries: 0,
  workers: 2,
  outputDir: "test/scratch/browser-artifacts",
  reporter: [["list"], ["json", { outputFile: "../docs/validation/integration/frontend/e2e.json" }]],
  use: { baseURL: "http://127.0.0.1:4173/", trace: "off", screenshot: "off" },
  webServer: {
    command: "npx vite preview --port 4173 --strictPort --host 127.0.0.1",
    url: "http://127.0.0.1:4173/",
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
