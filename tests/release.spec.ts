import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fixture, hierarchyFixture, line, node } from "./fixtures";
import { mount, hostState, update, assertBrowserClean } from "./harness";
import { sampleFixture } from "./sampleFixture";

const viewports = [[80, 80], [258, 198], [398, 298], [1280, 620], [1366, 768]] as const;
test.afterEach(async ({ page }) => assertBrowserClean(page));

for (const [width, height] of viewports) {
    test(`packaged ${width}x${height}: readable grid or honest small-tile notice, onboarding and error recovery`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        const { data } = sampleFixture();
        await mount(page, data, { width, height });
        if (width < 256) {
            await expect(page.locator(".afm-small")).toContainText("Enlarge visual");
            await expect(page.locator('[role="grid"]')).toHaveCount(0);
            const minimum = (await page.locator(".afm-minimum").boundingBox())!;
            expect(minimum.y + minimum.height).toBeLessThanOrEqual(height);
            await expect(page.locator(".afm-footer")).toBeHidden();
        } else {
            await expect(page.locator('[role="grid"]')).toHaveAttribute("aria-rowcount", "20");
            const header = await page.locator(".afm-corner").boundingBox();
            const actual = await page.locator("tr.afm-row").first().locator("td").first().boundingBox();
            expect(actual!.x).toBeGreaterThanOrEqual(header!.x + header!.width - 1);
            expect(actual!.x + actual!.width).toBeLessThanOrEqual(width + 1);
            expect(header!.width).toBeLessThan(width);
            await page.locator("tr.afm-row th").first().focus();
            await page.keyboard.press("Control+End");
            await expect(page.locator('[data-line-id="pl.customers"] td').last()).toBeFocused();
            const focus = await page.locator(":focus").boundingBox();
            const viewport = await page.locator(".afm-scroll").boundingBox();
            expect(focus!.y).toBeGreaterThanOrEqual(viewport!.y + 63);
            expect(focus!.x + focus!.width).toBeLessThanOrEqual(width + 1);
            expect(focus!.y + focus!.height).toBeLessThanOrEqual(viewport!.y + viewport!.height + 1);
            const period = await page.locator(".afm-period span").last().boundingBox();
            expect(period!.x).toBeGreaterThanOrEqual(header!.x + header!.width);
            expect(period!.x + period!.width).toBeLessThanOrEqual(width + 1);
        }
        mkdirSync(join("dist", "quality"), { recursive: true });
        await page.screenshot({ path: join("dist", "quality", `layout-${width}x${height}.png`) });
        data.metadata.segment = {};
        await update(page, data, width, height);
        await expect(page.locator(".afm-status")).toContainText("PARTIAL DATA");
        data.metadata.objects!.statement!.lines = '[{"id":"bad","sign":2}]';
        await update(page, data, width, height);
        await expect(page.locator('[role="alert"]')).toBeVisible();
        await expect(page.locator('[role="alert"]')).toContainText("[1] bad");
        await expect(page.locator("tr.afm-row")).toHaveCount(0);
        await update(page, undefined, width, height);
        await expect(page.locator(".afm-setup")).toContainText("Build a financial statement");
        await expect(page.locator(".afm-example textarea")).toHaveAttribute("readonly");
        await update(page, sampleFixture().data, width, height);
        expect((await hostState(page)).events.at(-1)).toBe("finished");
    });
}

test("all 1000 row boundaries, half-row offsets and horizontal extremes retain data and frozen geometry", async ({ page }) => {
    test.setTimeout(120000);
    const lines = Array.from({ length: 1000 }, (_, index) => line(`row-${index}`, index));
    await mount(page, fixture(lines, 3), { width: 1280, height: 620 });
    const result = await page.evaluate(async () => {
        const scroll = document.querySelector<HTMLDivElement>(".afm-scroll")!;
        const failures: string[] = [];
        let maxRows = 0;
        let positions = 0;
        const initialCorner = document.querySelector(".afm-corner")!.getBoundingClientRect();
        const pause = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        for (let index = 0; index < 1000; index++) {
            scroll.scrollTop = index * 36 + (index % 2 ? 18 : 0);
            scroll.scrollLeft = index % 3 === 0 ? 0 : index % 3 === 1 ? (scroll.scrollWidth - scroll.clientWidth) / 2 : scroll.scrollWidth;
            await pause();
            const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>("tr.afm-row"));
            maxRows = Math.max(maxRows, rows.length);
            const box = scroll.getBoundingClientRect();
            const corner = document.querySelector(".afm-corner")!.getBoundingClientRect();
            if (Math.abs(corner.x - initialCorner.x) > 1 || Math.abs(corner.y - initialCorner.y) > 1) failures.push(`sticky:${index}`);
            const visible = rows.filter(row => {
                const rect = row.getBoundingClientRect();
                return rect.bottom > box.y + 64 && rect.y < box.y + scroll.clientHeight;
            });
            if (!visible.length) failures.push(`blank:${index}`);
            for (const row of visible) {
                const id = Number(row.dataset.lineId?.replace("row-", ""));
                if (row.getAttribute("aria-rowindex") !== String(id + 3)) failures.push(`aria:${index}:${id}`);
                const first = row.querySelector("td .afm-value")?.textContent;
                if (first !== `$${((id + 1) * 100).toLocaleString("en-US")}`) failures.push(`value:${index}:${id}`);
            }
            positions++;
        }
        return { failures, maxRows, positions, rowCount: document.querySelector('[role="grid"]')!.getAttribute("aria-rowcount") };
    });
    expect(result.failures).toEqual([]);
    expect(result.positions).toBe(1000);
    expect(result.maxRows).toBeLessThan(35);
    expect(result.rowCount).toBe("1002");
    await page.locator("tr.afm-row th").last().focus();
    await page.keyboard.press("Control+Home");
    await expect(page.locator('[data-line-id="row-0"] th')).toBeFocused();
    await page.keyboard.press("Control+End");
    await expect(page.locator('[data-line-id="row-999"] td').last()).toBeFocused();
});

test("maximum-width partial grid reaches every period and last bounded row with stable selection", async ({ page }) => {
    const lines = Array.from({ length: 1000 }, (_, index) => line(`wide-${index}`, index));
    const data = fixture(lines, 25);
    await mount(page, data, { width: 398, height: 298 });
    await expect(page.locator(".afm-status")).toContainText("PARTIAL DATA");
    await expect(page.locator('[role="grid"]')).toHaveAttribute("aria-colcount", "169");
    await page.locator("tr.afm-row th").first().focus();
    await page.keyboard.press("Control+End");
    await expect(page.locator('[data-line-id="wide-141"] td').last()).toBeFocused();
    await page.keyboard.press("Enter");
    expect((await hostState(page)).selected[0]).toContain("period-23");
    expect((await hostState(page)).selected[0]).not.toContain("measure:");
    const keys = await page.locator("thead .afm-period").allTextContents();
    expect(keys).toHaveLength(24);
    expect(new Set(keys).size).toBe(24);
    expect(await page.locator("tr.afm-row td").count()).toBeLessThan(6000);
});

test("long captions and values expose complete labels without changing accounting row heights", async ({ page }) => {
    const lines = Array.from({ length: 20 }, (_, index) => line(`long-${index}`, index, {
        label: `Statement line ${index} ` + "long caption ".repeat(12),
        format: "$#,0.000000000000000"
    }));
    await mount(page, fixture(lines), { width: 258, height: 198 });
    const row = page.locator("tr.afm-row").first();
    await expect(row.locator("th")).toHaveAttribute("title", `${lines[0]!.label} (long-0)`);
    expect((await row.boundingBox())!.height).toBe(36);
    expect(await row.locator(".afm-label").evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
    await expect(row.locator("td").first()).toHaveAttribute("title", /100\.000000000000000/);
    await row.locator("th").focus();
    await page.keyboard.press("End");
    expect((await page.locator(":focus").boundingBox())!.width).toBeCloseTo(136, 0);
});

test("20000 supplied rows are bounded honestly and 16-digit integer values remain intact", async ({ page }) => {
    const lines = Array.from({ length: 1000 }, (_, index) => line(`large-${index}`, index, {
        unit: "number", format: index === 2 ? "0.000000" : index === 1 ? "#,0;(#,0);0" : "#,0", variance: "none"
    }));
    const data = fixture(lines, 1, ["Actual"]);
    data.matrix!.rows.root.children![0]!.values = { 0: { value: 1234567890123456 } };
    data.matrix!.rows.root.children![1]!.values = { 0: { value: -1234567890123456 } };
    data.matrix!.rows.root.children![2]!.values = { 0: { value: 0.000001 } };
    data.matrix!.rows.root.children!.push(...Array.from({ length: 19000 }, (_, index) => node(`overflow-${index}`, [index], 0, 1)));
    await mount(page, data, { width: 1280, height: 620 });
    await expect(page.locator('[role="grid"]')).toHaveAttribute("aria-rowcount", "1002");
    await expect(page.locator(".afm-status")).toContainText("PARTIAL DATA");
    await expect(page.locator('[data-line-id="large-0"] td')).toHaveText("1,234,567,890,123,456");
    await expect(page.locator('[data-line-id="large-1"] td')).toHaveText("(1,234,567,890,123,456)");
    await expect(page.locator('[data-line-id="large-2"] td')).toHaveText("0.000001");
    expect((await hostState(page)).failures).toEqual([]);
    await page.locator('[data-line-id="large-0"] th').focus();
    await page.keyboard.press("Control+End");
    await expect(page.locator('[data-line-id="large-999"] td')).toBeFocused();
    expect(await page.locator("tr.afm-row").count()).toBeLessThan(35);
});

test("shared packaged module isolates instances, cultures, high contrast, settings and selection callbacks", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 1100 });
    const { data } = sampleFixture();
    await mount(page, data, { instance: "english", width: 1000, height: 500 });
    await mount(page, data, { instance: "french", append: true, locale: "fr-FR", highContrast: true, width: 1000, height: 500 });
    const first = page.locator("#visual-english");
    const second = page.locator("#visual-french");
    await expect(first.locator('[data-line-id="pl.gross-margin"] td').first()).toHaveText("56.4%");
    await expect(second.locator('[data-line-id="pl.gross-margin"] td').first()).toHaveText("56,4%");
    await first.locator("tr.afm-row th").first().click();
    expect((await hostState(page, "english")).selected).toHaveLength(1);
    expect((await hostState(page, "french")).selected).toHaveLength(0);
    await expect(first.locator(".afm")).toHaveCSS("color", "rgb(25, 45, 61)");
    await expect(second.locator(".afm")).toHaveCSS("color", "rgb(255, 255, 0)");
    await page.evaluate(() => {
        const world = window as typeof window & { instances: Record<string, { clearFromHost: () => void }> };
        world.instances.english!.clearFromHost();
    });
    await expect(first.locator(".afm-selected-cell")).toHaveCount(0);
    await page.evaluate(() => {
        const world = window as typeof window & { instances: Record<string, { destroy: () => void }> };
        world.instances.english!.destroy();
    });
    await expect(first.locator(".afm")).toHaveCount(0);
    await second.locator("tr.afm-row th").first().click();
    expect((await hostState(page, "french")).selected).toHaveLength(1);
});

test("settings replay and host rejection recover without losing partial notices or identity", async ({ page }) => {
    const { data } = hierarchyFixture();
    data.metadata.segment = {};
    await mount(page, data, { width: 1280, height: 620 });
    await page.evaluate(() => { (window as typeof window & { hostState: { rejectNext: boolean } }).hostState.rejectNext = true; });
    await page.locator('[data-line-id="sales"] td').first().click();
    await expect(page.locator('[role="alert"]')).toContainText("host rejected");
    await expect(page.locator('[role="alert"]')).toContainText("PARTIAL DATA");
    const metadata = data.metadata.objects!.statement!;
    metadata.direction = true;
    metadata.variances = false;
    await update(page, data);
    await expect(page.locator(".afm")).toHaveAttribute("dir", "rtl");
    await expect(page.locator('[role="grid"]')).toHaveAttribute("aria-colcount", "4");
    await page.locator('[data-line-id="sales"] td').first().click();
    expect((await hostState(page)).selected[0]).toContain("sales");
    expect((await hostState(page)).selected[0]).toContain("Measures.Actual");
    metadata.direction = false;
    metadata.variances = true;
    await update(page, data);
    await expect(page.locator(".afm")).toHaveAttribute("dir", "ltr");
    await expect(page.locator('[role="grid"]')).toHaveAttribute("aria-colcount", "8");
    await expect(page.locator(".afm-status")).not.toContainText("host rejected");
});

test("RTL frozen period captions and focused cells remain reachable at scroll extremes and resize", async ({ page }) => {
    await page.setViewportSize({ width: 398, height: 298 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const data = fixture(Array.from({ length: 200 }, (_, index) => line(`rtl-${index}`, index)), 3);
    data.metadata.objects!.statement!.direction = true;
    await mount(page, data, { width: 398, height: 298, highContrast: true });
    await page.locator("tr.afm-row th").first().focus();
    await page.keyboard.press("Control+End");
    const last = page.locator('[data-line-id="rtl-199"] td').last();
    await expect(last).toBeFocused();
    const corner = (await page.locator(".afm-corner").boundingBox())!;
    const focused = (await last.boundingBox())!;
    const caption = (await page.locator(".afm-period span").last().boundingBox())!;
    expect(focused.x).toBeGreaterThanOrEqual(-1);
    expect(focused.x + focused.width).toBeLessThanOrEqual(corner.x + 1);
    expect(caption.x).toBeGreaterThanOrEqual(-1);
    expect(caption.x + caption.width).toBeLessThanOrEqual(corner.x + 1);
    await page.setViewportSize({ width: 1280, height: 620 });
    await update(page, data, 1280, 620);
    await expect(last).toBeFocused();
    await page.keyboard.press("Enter");
    expect((await hostState(page)).selected[0]).toContain("rtl-199");
    expect((await hostState(page)).selected[0]).toContain("period-2");
    await page.keyboard.press("Control+Home");
    await expect(page.locator('[data-line-id="rtl-0"] th')).toBeFocused();
});

test.describe("touch input", () => {
    test.use({ hasTouch: true });
    test("real touch tap selects and tooltips carry touch context; pan scroll is not a selection", async ({ page }) => {
        const lines = Array.from({ length: 100 }, (_, index) => line(`touch-${index}`, index));
        await mount(page, fixture(lines, 3), { width: 398, height: 298 });
        const first = page.locator("tr.afm-row td").first();
        await first.tap();
        expect((await hostState(page)).selected).toHaveLength(1);
        expect((await hostState(page)).tooltipTouch.at(-1)).toBe(true);
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 340, y: 230 }] });
        for (const y of [200, 170, 140, 110, 80]) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 340, y }] });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await expect.poll(() => page.locator(".afm-scroll").evaluate(element => element.scrollTop)).toBeGreaterThan(50);
        expect((await hostState(page)).selected).toHaveLength(1);
        expect((await hostState(page)).tooltipHides).toContain(true);
    });
});
