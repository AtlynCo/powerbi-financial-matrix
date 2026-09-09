import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./tests",
    testMatch: "evidence.spec.ts",
    workers: 1,
    retries: 0,
    timeout: 300000,
    outputDir: ".tmp/evidence-runner",
    reporter: [["list"], ["json", { outputFile: "dist/evidence-runner-results.json" }]],
    use: { browserName: "chromium", viewport: { width: 1366, height: 768 }, headless: true }
});
