import { defineConfig, devices } from "@playwright/test";

// The end-to-end tests run on the built site (npm run build), served by vite preview. The smoke
// test runs on desktop Chromium; the specs meant for phones also run in the phone projects of
// docs/PHONE.md §9.4, a Pixel 7 with touch and an iPhone 15 in WebKit, which only CI installs.
export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  use: { baseURL: "http://localhost:4173" },
  projects: [
    { name: "chromium", use: { browserName: "chromium" }, testIgnore: "touch.spec.ts" },
    { name: "chromium-phone", use: devices["Pixel 7"], testIgnore: "smoke.spec.ts" },
    { name: "webkit-iphone", use: devices["iPhone 15"], testIgnore: "smoke.spec.ts" },
  ],
  webServer: {
    command: "npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: false,
  },
});
