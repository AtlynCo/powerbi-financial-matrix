import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./tests",
    testMatch: "browser.spec.ts",
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [["list"], ["json", { outputFile: "test-results/browser-results.json" }]],
    use: { browserName: "chromium", viewport: { width: 1100, height: 800 }, headless: true, screenshot: "only-on-failure" }
});
