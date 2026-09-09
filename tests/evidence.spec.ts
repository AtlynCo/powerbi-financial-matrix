import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";
import { readArtifact } from "../scripts/artifact.mjs";
import { fixture, line } from "./fixtures";
import { sampleFixture } from "./sampleFixture";
import { listingFixture } from "./evidence-fixtures";
import { mount, assertBrowserClean } from "./harness";

test.afterEach(async ({ page }) => assertBrowserClean(page));

test("capture actual packaged statement listing assets with no runtime requests", async ({ page }) => {
    const requests: string[] = [];
    await page.route("**/*", route => { requests.push(route.request().url()); return route.abort(); });
    const artifact = await readArtifact();
    const folder = join("dist", "submission-assets");
    mkdirSync(folder, { recursive: true });
    const files: string[] = [];
    for (const kind of ["pnl", "balance", "cashflow"] as const) {
        await mount(page, listingFixture(kind), { width: 1366, height: 768 });
        await expect(page.locator('[role="grid"]')).toBeVisible();
        await expect(page.locator('[role="alert"]')).toHaveCount(0);
        const filename = `screenshot-${kind}.png`;
        await page.screenshot({ path: join(folder, filename), animations: "disabled" });
        files.push(filename);
    }
    expect(requests).toEqual([]);
    writeFileSync(join(folder, "capture-provenance.json"), JSON.stringify({
        capturedAt: new Date().toISOString(), packageSha256: artifact.sha256, width: 1366, height: 768,
        files, runtimeRequests: requests,
        provenance: "Real Chromium renders of JS/CSS from the exact official PBIVIZ. Numeric inputs come from checked-in synthetic sample expected results/literals. Mocked Power BI host; not Desktop, service, M/DAX execution or native export evidence.",
        nativeReplacementGate: "Owner must accept or replace these candidate listing screenshots after real Desktop/PBIX sample validation. No Power BI host chrome is fabricated."
    }, null, 2) + "\n");
});

test("measure real local render scroll and selection distributions for practical and bounded workloads", async ({ page, browser }) => {
    const artifact = await readArtifact();
    const sampleCount = 30;
    const warmups = 3;
    const scenarios = [
        { name: "pnl", data: sampleFixture().data, expectedRows: 18, expectedColumns: 21 },
        { name: "practical-250x7", data: fixture(Array.from({ length: 250 }, (_, i) => line(`p${i}`, i)), 1), expectedRows: 250, expectedColumns: 7 },
        { name: "max-rows-1000x21", data: fixture(Array.from({ length: 1000 }, (_, i) => line(`m${i}`, i)), 3), expectedRows: 1000, expectedColumns: 21 },
        { name: "max-cells-1000x24", data: fixture(Array.from({ length: 1000 }, (_, i) => line(`c${i}`, i)), 24, ["Actual"]), expectedRows: 1000, expectedColumns: 24 },
        { name: "max-columns-142x168", data: fixture(Array.from({ length: 142 }, (_, i) => line(`w${i}`, i)), 24), expectedRows: 142, expectedColumns: 168 }
    ];
    const results = [];
    const stats = (values: number[]) => {
        const ordered = [...values].sort((a, b) => a - b);
        return { p50: ordered[Math.ceil(ordered.length * 0.5) - 1], p95: ordered[Math.ceil(ordered.length * 0.95) - 1], max: ordered.at(-1), samples: values };
    };
    for (const scenario of scenarios) {
        await mount(page, scenario.data, { width: 1280, height: 620 });
        await expect(page.locator('[role="grid"]')).toHaveAttribute("aria-rowcount", String(scenario.expectedRows + 2));
        await expect(page.locator('[role="grid"]')).toHaveAttribute("aria-colcount", String(scenario.expectedColumns + 1));
        const raw = await page.evaluate(async ({ data, sampleCount, warmups }) => {
            const world = window as typeof window & { updateVisual: (data: unknown, width: number, height: number) => void; hostState: { renderDurations: number[] } };
            const pause = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
            const output = { renderToFrames: [] as number[], synchronousRender: [] as number[], scrollToFrames: [] as number[], selectionToFrames: [] as number[], maxDomCells: 0 };
            for (let iteration = -warmups; iteration < sampleCount; iteration++) {
                const renderStart = performance.now();
                world.updateVisual(data, 1280, 620);
                await pause();
                const renderTime = performance.now() - renderStart;
                const syncTime = world.hostState.renderDurations.at(-1)!;
                const scroll = document.querySelector<HTMLDivElement>(".afm-scroll")!;
                const step = (iteration + warmups) % 3 / 2;
                const scrollStart = performance.now();
                scroll.scrollTop = (scroll.scrollHeight - scroll.clientHeight) * step;
                scroll.scrollLeft = (scroll.scrollWidth - scroll.clientWidth) * step;
                await pause();
                const scrollTime = performance.now() - scrollStart;
                const viewport = scroll.getBoundingClientRect();
                const label = document.querySelector(".afm-corner")!.getBoundingClientRect();
                const cell = Array.from(document.querySelectorAll<HTMLTableCellElement>("tr.afm-row td")).find(cell => {
                    const box = cell.getBoundingClientRect();
                    return box.y >= viewport.y + 64 && box.bottom <= viewport.bottom && box.x >= label.right && box.right <= viewport.right;
                });
                if (!cell) throw new Error("No fully visible numeric cell for selection measurement.");
                const selectStart = performance.now();
                cell.click();
                await pause();
                const selectionTime = performance.now() - selectStart;
                if (iteration >= 0) {
                    output.renderToFrames.push(renderTime);
                    output.synchronousRender.push(syncTime);
                    output.scrollToFrames.push(scrollTime);
                    output.selectionToFrames.push(selectionTime);
                    output.maxDomCells = Math.max(output.maxDomCells, document.querySelectorAll("tr.afm-row td").length);
                }
            }
            return output;
        }, { data: scenario.data, sampleCount, warmups });
        for (const values of [raw.renderToFrames, raw.synchronousRender, raw.scrollToFrames, raw.selectionToFrames]) {
            expect(values).toHaveLength(sampleCount);
            expect(values.every(value => Number.isFinite(value) && value >= 0)).toBe(true);
        }
        results.push({
            name: scenario.name, rows: scenario.expectedRows, columns: scenario.expectedColumns, maxDomCells: raw.maxDomCells,
            renderToFramesMs: stats(raw.renderToFrames), synchronousRenderMs: stats(raw.synchronousRender),
            scrollToFramesMs: stats(raw.scrollToFrames), selectionToFramesMs: stats(raw.selectionToFrames)
        });
    }
    const report = {
        measuredAt: new Date().toISOString(), packageSha256: artifact.sha256, sampleCount, warmups,
        percentile: "Nearest rank on 30 observed samples; raw samples included. No outliers removed.",
        environment: {
            platform: process.platform, osRelease: os.release(), arch: process.arch, node: process.version,
            cpuModel: os.cpus()[0]?.model.trim(), logicalCpus: os.cpus().length, memoryGiB: os.totalmem() / 1073741824,
            browser: browser.version(), viewport: { width: 1280, height: 620 }, workers: 1, headless: true
        },
        boundaries: [
            "Shared/possibly contended VM; no claim of idle CPU, dedicated hardware, production latency SLO or cross-machine comparison.",
            "Inputs are prebuilt synthetic DataViews; model query, native host async selection, network and Desktop/service overhead excluded.",
            "Render-to-frames starts at visual.update and ends after two requestAnimationFrame callbacks. Synchronous render uses host rendering events.",
            "Scroll-to-frames alternates real scrollTop/scrollLeft at start/middle/end and includes virtual-window scheduling plus two frame callbacks.",
            "Selection-to-frames measures DOM cell.click, immediate mocked selection callback and two frames; excludes physical input/automation transport.",
            "No benchmark threshold is presented as Microsoft certification or native export readiness. Rerun locally on the exact final package."
        ],
        results
    };
    mkdirSync(join("dist", "quality"), { recursive: true });
    writeFileSync(join("dist", "quality", "performance.json"), JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(results.map(({ name, renderToFramesMs, scrollToFramesMs, selectionToFramesMs }) => ({
        name, render: { p50: renderToFramesMs.p50, p95: renderToFramesMs.p95, max: renderToFramesMs.max },
        scroll: { p50: scrollToFramesMs.p50, p95: scrollToFramesMs.p95, max: scrollToFramesMs.max },
        selection: { p50: selectionToFramesMs.p50, p95: selectionToFramesMs.p95, max: selectionToFramesMs.max }
    })), null, 2));
});
