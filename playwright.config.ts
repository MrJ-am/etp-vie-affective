import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 45000,
  expect: { timeout: 12000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"],["json",{outputFile:"docs/browser-results.json"}]],
  outputDir: "runtime/browser",
  use: {
    baseURL: process.env.CARNET_TEST_URL || "http://localhost:3000",
    viewport: {width:1440,height:1000},
    trace: "off", screenshot: "off", video: "off"
  },
  projects: [{name:"chromium",use:{browserName:"chromium"}},{name:"webkit",use:{browserName:"webkit"}},{name:"firefox",use:{browserName:"firefox"}}]
});
