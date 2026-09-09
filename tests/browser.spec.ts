import { test, expect } from "@playwright/test";
import { fixture, hierarchyFixture, line, node } from "./fixtures";
import { hostState, mount, update } from "./harness";
import { sampleFixture } from "./sampleFixture";

test("real packaged JS formats mixed rows, sign/variance, highlight, modern settings and no network", async ({ page }) => {
    const requests: string[] = [];
    await page.route("**/*", route => { requests.push(route.request().url()); return route.abort(); });
    const { data } = hierarchyFixture();
    data.matrix!.rows.root.children![2]!.values![0]!.highlight = 12;
    await mount(page, data);
    await expect(page.locator('[data-line-id="profit"] td').first()).toContainText("$60");
    await expect(page.locator('[data-line-id="profit"] .afm-highlight').first()).toHaveText("H: $12");
    await expect(page.locator('[data-line-id="cost"] td').first()).toContainText("$40");
    await expect(page.locator('[data-line-id="cost"] td').nth(3)).toContainText("F ($5)");
    await expect(page.locator('[data-line-id="margin"] td').first()).toContainText("60.0%");
    await expect(page.locator('[data-line-id="margin"] td').nth(3)).toContainText("pp");
    await expect(page.locator('[data-line-id="margin"] td').nth(4)).toHaveText("");
    await expect(page.locator('[data-line-id="customers"] td').first()).toContainText("7");
    const model = await page.evaluate(() => (window as typeof window & { formattingModel: () => unknown }).formattingModel());
    expect(JSON.stringify(model)).toContain("statement");
    expect(JSON.stringify(model)).toContain("TextArea");
    expect((await hostState(page)).events).toEqual(["started", "finished"]);
    expect(requests).toEqual([]);
});

test("sticky header/first column survive real vertical and horizontal scroll; resize stays bounded", async ({ page }) => {
    const lines = Array.from({ length: 180 }, (_, i) => line(`L${i}`, i, { label: `Statement line ${i}` }));
    await mount(page, fixture(lines, 8), { width: 700, height: 360 });
    const scroll = page.locator(".afm-scroll");
    const before = await page.locator(".afm-corner").boundingBox();
    await scroll.hover();
    await page.mouse.wheel(600, 950);
    await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeGreaterThan(500);
    await expect.poll(() => scroll.evaluate(el => el.scrollLeft)).toBeGreaterThan(200);
    const after = await page.locator(".afm-corner").boundingBox();
    expect(Math.abs(after!.x - before!.x)).toBeLessThan(2);
    expect(Math.abs(after!.y - before!.y)).toBeLessThan(2);
    const visible = page.locator('[data-line-id="L35"] .afm-row-header');
    const firstColumn = await visible.boundingBox();
    expect(firstColumn!.x).toBeCloseTo(before!.x, 0);
    const bounds = await scroll.evaluate(el => ({ h: el.clientHeight, sh: el.scrollHeight, w: el.clientWidth, sw: el.scrollWidth }));
    expect(bounds.sh).toBeGreaterThan(bounds.h);
    expect(bounds.sw).toBeGreaterThan(bounds.w);
    await update(page, fixture(lines, 8), 420, 250);
    expect((await page.locator(".afm").boundingBox())!.width).toBe(420);
    expect(await scroll.evaluate(el => el.scrollTop)).toBeGreaterThan(500);
    expect(await page.locator("tbody td").count()).toBeLessThanOrEqual(24000);
});

test("keyboard reaches offscreen rows/columns without hiding focus behind frozen headers", async ({ page }) => {
    const lines = Array.from({ length: 100 }, (_, i) => line(`L${i}`, i));
    await mount(page, fixture(lines, 5), { width: 700, height: 350 });
    const first = page.locator("tbody th").first();
    await first.focus();
    await page.keyboard.press("Control+End");
    await expect(page.locator("tbody tr").last().locator("td").last()).toBeFocused();
    const focused = await page.locator(":focus").boundingBox();
    const viewport = await page.locator(".afm-scroll").boundingBox();
    expect(focused!.y).toBeGreaterThanOrEqual(viewport!.y + 40);
    expect(focused!.y + focused!.height).toBeLessThanOrEqual(viewport!.y + viewport!.height + 1);
    expect(focused!.x).toBeGreaterThanOrEqual(viewport!.x + 279);
    await page.keyboard.press("PageUp");
    await expect(page.locator("tbody tr").last().locator("td").last()).not.toBeFocused();
    await page.keyboard.press("Control+Home");
    await expect(first).toBeFocused();
    expect(await page.locator(".afm-scroll").evaluate(el => el.scrollTop)).toBeLessThan(2);
});

test("native row/cell selection identities remain stable across sorting, local collapse, tooltip and menu", async ({ page }) => {
    const { data } = hierarchyFixture();
    await mount(page, data);
    const sales = page.locator('[data-line-id="sales"] th');
    await sales.click();
    let state = await hostState(page);
    const selectedRow = state.selected[0]!;
    expect(selectedRow).toContain("profit");
    expect(selectedRow).toContain("sales");
    expect(selectedRow).not.toContain("measure:");
    const value = page.locator('[data-line-id="sales"] td').first();
    await value.click({ modifiers: ["Control"] });
    state = await hostState(page);
    expect(state.selected).toHaveLength(2);
    expect(state.selected[1]).toContain("period-0");
    expect(state.selected[1]).toContain("Measures.Actual");
    expect(state.levels.every(count => count > 0)).toBe(true);
    await value.hover();
    expect((await hostState(page)).tooltips.at(-1)).toContain("Measures.Actual");
    await page.keyboard.press("Shift+F10");
    expect((await hostState(page)).contexts.at(-1)).toBe(state.selected[1]);
    await page.locator('[data-line-id="profit"] button').click();
    await expect(sales).toHaveCount(0);
    await expect(page.locator('[data-line-id="profit"] td').first()).toHaveText("$60");
    await page.keyboard.press("+");
    await expect(sales).toBeVisible();
    data.matrix!.rows.root.children!.reverse();
    await update(page, data);
    await sales.click();
    expect((await hostState(page)).selected[0]).toBe(selectedRow);
    await page.keyboard.press("Escape");
    expect((await hostState(page)).selected).toEqual([]);
    await page.locator('[data-line-id="sales"] td').nth(3).click({ button: "right" });
    expect((await hostState(page)).contexts.at(-1)).not.toContain("measure:");
});

test("invalid, empty, partial and zero-reference data are visible not fabricated", async ({ page }) => {
    const data = fixture();
    data.metadata.segment = {};
    data.matrix!.rows.root.children = [node("revenue", [0, 0, null])];
    await mount(page, data);
    await expect(page.locator(".afm-status")).toContainText("PARTIAL DATA");
    await expect(page.locator("tbody td").nth(4)).toHaveText("N/A");
    await expect(page.locator("tbody td").nth(2)).toHaveText("-");
    data.matrix!.rows.root.children![0]!.values![0]!.value = Infinity;
    await update(page, data);
    await expect(page.locator("tbody td").first()).toHaveText("!");
    data.metadata.objects!.statement!.lines = "not json";
    await update(page, data);
    await expect(page.locator('[role="alert"]')).toContainText("Invalid line metadata JSON");
    await expect(page.locator("tbody td")).toHaveCount(0);
    expect((await hostState(page)).events.at(-1)).toBe("failed");
    await update(page, undefined);
    await expect(page.locator(".afm-status")).toContainText("Bind Line ID");
    expect((await hostState(page)).events.at(-1)).toBe("finished");
});

test("notice-free successful render followed by invalid metadata shows a visible diagnostic", async ({ page }) => {
    const data = fixture();
    await mount(page, data);
    await expect(page.locator(".afm-status")).toBeHidden();
    data.metadata.objects!.statement!.lines = "not json";
    await update(page, data);
    await expect(page.locator('[role="alert"]')).toBeVisible();
    await expect(page.locator('[role="alert"]')).toContainText("Invalid line metadata JSON");
    await expect(page.locator("tbody td")).toHaveCount(0);
});

test("RTL, high contrast, localized formats, reduced motion and safe text survive packaging", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const lines = [line("safe", 1, { label: '<img src="https://invalid.test/x" onerror="alert(1)">' })];
    const data = fixture(lines, 3);
    data.metadata.objects!.statement!.direction = true;
    await mount(page, data, { locale: "fr-FR", highContrast: true, width: 700 });
    await expect(page.locator(".afm")).toHaveAttribute("dir", "rtl");
    await expect(page.locator(".afm")).toHaveCSS("color", "rgb(255, 255, 0)");
    await expect(page.locator(".afm")).toHaveCSS("background-color", "rgb(0, 0, 0)");
    await expect(page.locator(".afm-corner")).toHaveText("Ligne de l'etat");
    await expect(page.locator(".afm-row-header")).toHaveText(lines[0]!.label);
    await expect(page.locator(".afm img")).toHaveCount(0);
    const corner = await page.locator(".afm-corner").boundingBox();
    const viewport = await page.locator(".afm-scroll").boundingBox();
    expect(corner!.x + corner!.width).toBeCloseTo(viewport!.x + viewport!.width, 0);
    await page.locator("tbody th").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator("tbody td").first()).toBeFocused();
    await page.keyboard.press("End");
    const focused = await page.locator(":focus").boundingBox();
    expect(focused!.x + focused!.width).toBeLessThanOrEqual(viewport!.x + viewport!.width - 279);
    await expect(page.locator(".afm-cell").first()).toHaveCSS("transition-duration", "0s");
});

test("missing leaf identity never selects an ancestor; disabled host interactions are respected", async ({ page }) => {
    const { data } = hierarchyFixture();
    delete data.matrix!.rows.root.children![2]!.children![1]!.identity;
    await mount(page, data);
    await page.locator('[data-line-id="sales"] td').first().click();
    expect((await hostState(page)).selected).toEqual([]);
    await expect(page.locator(".afm-status")).toContainText("usable selection identity");
    await mount(page, fixture(), { interactions: false });
    await page.locator("tbody td").first().click();
    expect((await hostState(page)).selected).toEqual([]);
});

test("checked-in P&L example renders expected supplied inputs in the real package", async ({ page }) => {
    const { data } = sampleFixture();
    await mount(page, data, { width: 1000, height: 700 });
    await expect(page.locator("tbody tr")).toHaveCount(18);
    await expect(page.locator('[data-line-id="pl.revenue"] td').first()).toHaveText("$126,200");
    await expect(page.locator('[data-line-id="pl.materials"] td').first()).toHaveText("($45,000)");
    await expect(page.locator('[data-line-id="pl.materials"] td').nth(3)).toHaveText("U ($3,000)");
    await expect(page.locator('[data-line-id="pl.gross-margin"] td').first()).toHaveText("56.4%");
    await expect(page.locator('[data-line-id="pl.gross-margin"] td').nth(3)).toHaveText("F 0.6 pp");
    await expect(page.locator('[data-line-id="pl.launch-revenue"] td').nth(4)).toHaveText("N/A");
    await expect(page.locator('[data-line-id="pl.launch-revenue"] td').nth(2)).toHaveText("-");
    await expect(page.locator('[data-line-id="pl.customers"] td').first()).toHaveText("3");
    expect((await hostState(page)).failures).toEqual([]);
});
