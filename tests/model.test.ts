import { test } from "node:test";
import assert from "node:assert/strict";
import { ContractError, convert, getCell, LIMITS, numeric, parseLines, visibleRows } from "../src/model";
import { fixture, hierarchyFixture, line, node } from "./fixtures";
import { sampleFixture } from "./sampleFixture";

const config = (lines = [line("revenue", 1)]) => parseLines(JSON.stringify(lines));
const expectContract = (fn: () => unknown, key: string) => assert.throws(fn, error => error instanceof ContractError && error.key === key);

test("strict metadata rejects malformed, oversize, unknown keys and ambiguous IDs", () => {
    expectContract(() => parseLines("{bad"), "Error_Json");
    expectContract(() => parseLines("[]"), "Error_ConfigArray");
    expectContract(() => parseLines(" ".repeat(LIMITS.config + 1)), "Error_ConfigSize");
    expectContract(() => parseLines(JSON.stringify([line("a", 1), line("a", 2)])), "Error_DuplicateMetadata");
    expectContract(() => parseLines(JSON.stringify([{ ...line("a", 1), formula: "SUM(a)" }])), "Error_Metadata");
    expectContract(() => parseLines(JSON.stringify([{ ...line("a", 1), sign: 0 }])), "Error_Metadata");
    expectContract(() => config([line("a", 1, { unit: "percent" })]), "Error_VariancePolicy");
    expectContract(() => config([line("a", 1, { type: "heading" })]), "Error_VariancePolicy");
    assert.equal(config([line("__proto__", 1)]).get("__proto__")?.sign, 1);
});

test("fixed sibling order and supplied subtotals preserve nonadditive and count semantics", () => {
    const { data, lines } = hierarchyFixture();
    const result = convert(data, config(lines), true);
    assert.deepEqual(result.rows.map(row => row.line.id), ["profit", "sales", "cost", "margin", "customers"]);
    assert.deepEqual(getCell(result.rows[0]!, result.columns[0]!).number, { state: "number", value: 60 });
    assert.deepEqual(getCell(result.rows[3]!, result.columns[0]!).number, { state: "number", value: 0.6 });
    assert.deepEqual(getCell(result.rows[4]!, result.columns[0]!).number, { state: "number", value: 7 });
    assert.equal(getCell(result.rows[4]!, result.columns[3]!).number.state, "ineligible");
    const parent = data.matrix!.rows.root.children![2]!;
    delete parent.values;
    const missing = convert(data, config(lines), true);
    assert.equal(getCell(missing.rows[0]!, missing.columns[0]!).number.state, "missing");
    parent.children!.push({ isSubtotal: true, values: { 0: { value: 61 }, 1: { value: 51, valueSourceIndex: 1 }, 2: { value: 41, valueSourceIndex: 2 } } });
    const supplied = convert(data, config(lines), true);
    assert.deepEqual(getCell(supplied.rows[0]!, supplied.columns[0]!).number, { state: "number", value: 61 });
    assert.equal(supplied.rows.length, 5);
    parent.values = { 0: { value: 60 } };
    expectContract(() => convert(data, config(lines), true), "Error_Subtotals");
});

test("report subtotal lines do not create fabricated grand totals", () => {
    const lines = [line("one", 1), line("total", 2, { type: "subtotal" })];
    const data = fixture(lines);
    data.matrix!.rows.root.values = { 0: { value: 9999 } };
    data.matrix!.rows.root.children!.push({ isSubtotal: true, values: { 0: { value: 9999 } } });
    const result = convert(data, config(lines), true);
    assert.equal(result.rows.length, 2);
    assert.equal(result.issues[0]?.key, "Status_GrandTotal");
});

test("no accounting semantics inferred from labels or names", () => {
    const lines = [line("Revenue", 1, { label: "Loss / Expense / Profit", sign: 1, favorable: "neutral", variance: "none" })];
    const result = convert(fixture(lines), config(lines), true);
    assert.deepEqual(getCell(result.rows[0]!, result.columns[0]!).number, { state: "number", value: 100 });
    assert.equal(getCell(result.rows[0]!, result.columns[3]!).number.state, "ineligible");
});

test("sign inversion applies once and favorable direction uses displayed differences", () => {
    const { data, lines } = hierarchyFixture();
    const result = convert(data, config(lines), true);
    const row = result.rows.find(item => item.line.id === "cost")!;
    assert.deepEqual(getCell(row, result.columns[0]!).number, { state: "number", value: 40 });
    const absolute = getCell(row, result.columns[3]!);
    assert.deepEqual(absolute.number, { state: "number", value: -5 });
    assert.equal(absolute.favorable, "favorable");
    assert.deepEqual(getCell(row, result.columns[4]!).number, { state: "number", value: -5 / 45 });
    row.line.favorable = "higher";
    assert.equal(getCell(row, result.columns[3]!).favorable, "unfavorable");
});

test("percent absolute differences are points and relative percentage changes are ineligible", () => {
    const lines = [line("rate", 1, { unit: "percent", variance: "absolute", format: "0.0%" })];
    const data = fixture(lines);
    data.matrix!.rows.root.children = [node("rate", [0.6, 0.5, 0.4])];
    const result = convert(data, config(lines), true);
    const absolute = getCell(result.rows[0]!, result.columns[3]!);
    assert.equal(absolute.number.state, "number");
    if (absolute.number.state === "number") assert.ok(Math.abs(absolute.number.value - 10) < 0.0001);
    assert.match(absolute.format!, /pp/);
    assert.equal(getCell(result.rows[0]!, result.columns[4]!).number.state, "ineligible");
});

test("missing zero invalid and zero reference are distinct; overflow is invalid", () => {
    assert.deepEqual(numeric(null), { state: "missing" });
    assert.deepEqual(numeric(-0), { state: "number", value: 0 });
    for (const value of [NaN, Infinity, -Infinity, "100"]) assert.equal(numeric(value).state, "invalid");
    for (const actual of [0, 4]) {
        const data = fixture();
        data.matrix!.rows.root.children = [node("revenue", [actual, 0, null])];
        const result = convert(data, config(), true);
        assert.equal(getCell(result.rows[0]!, result.columns[4]!).number.state, "zeroReference");
        assert.equal(getCell(result.rows[0]!, result.columns[6]!).number.state, "missing");
    }
    const data = fixture();
    data.matrix!.rows.root.children = [node("revenue", [Number.MAX_VALUE, -Number.MAX_VALUE, 10])];
    const result = convert(data, config(), true);
    assert.equal(getCell(result.rows[0]!, result.columns[3]!).number.state, "invalid");
    assert.equal(getCell(result.rows[0]!, result.columns[4]!).number.state, "invalid");
});

test("negative reference uses its absolute denominator", () => {
    const data = fixture();
    data.matrix!.rows.root.children = [node("revenue", [-80, -100, 0])];
    const result = convert(data, config(), true);
    assert.deepEqual(getCell(result.rows[0]!, result.columns[4]!).number, { state: "number", value: 0.2 });
});

test("duplicate row IDs, sibling order and missing metadata reject instead of aggregate", () => {
    const data = fixture();
    data.matrix!.rows.root.children!.push(node("revenue", [1, 2, 3]));
    expectContract(() => convert(data, config(), true), "Error_RepeatedLine");
    const lines = [line("one", 1), line("two", 1)];
    expectContract(() => convert(fixture(lines), config(lines), true), "Error_Order");
    expectContract(() => convert(fixture(), config([line("Revenue", 1)]), true), "Error_MissingMetadata");
    const { data: nested, lines: hierarchyLines } = hierarchyFixture();
    nested.matrix!.rows.root.children![2]!.children!.push(node("customers", [1, 2, 3], 1));
    expectContract(() => convert(nested, config(hierarchyLines), true), "Error_RepeatedLine");
});

test("period slots and query-role order stay aligned, with no period sums", () => {
    const data = fixture([line("revenue", 1)], 2, ["Prior", "Actual", "Budget"]);
    const result = convert(data, config(), true);
    assert.equal(result.columns.length, 14);
    assert.equal(result.columns[0]?.slot, 1);
    assert.equal(result.columns[7]?.slot, 4);
    assert.equal(result.columns[0]?.source.queryName, "Measures.Actual");
    assert.deepEqual(getCell(result.rows[0]!, result.columns[0]!).number, { state: "number", value: 80 });
    data.matrix!.rows.root.children![0]!.values![1]!.valueSourceIndex = 2;
    expectContract(() => convert(data, config(), true), "Error_Columns");
});

test("Desktop period-only column hierarchy maps every projected measure in value-source order", () => {
    const data = fixture([line("revenue", 1)], 2);
    const periodSource = data.matrix!.columns.levels[0]!.sources[0]!;
    data.matrix!.columns = {
        levels: [{ sources: [periodSource] }],
        root: {
            children: [
                { level: 0, value: "2026-01", identity: { key: "period-0" } },
                { level: 0, value: "2026-02", identity: { key: "period-1" } }
            ]
        }
    };

    const result = convert(data, config(), true);

    assert.equal(result.columns.length, 14);
    assert.deepEqual(
        result.columns.filter(column => column.kind === "value").map(column => [column.period, column.scenario, column.slot]),
        [
            ["2026-01", "Actual", 0], ["2026-01", "Budget", 1], ["2026-01", "Prior", 2],
            ["2026-02", "Actual", 3], ["2026-02", "Budget", 4], ["2026-02", "Prior", 5]
        ]
    );
    assert.deepEqual(getCell(result.rows[0]!, result.columns[0]!).number, { state: "number", value: 100 });
    assert.deepEqual(getCell(result.rows[0]!, result.columns[7]!).number, { state: "number", value: 100 });
});

test("Desktop period-only subtotals advance by every projected measure slot", () => {
    const data = fixture([line("revenue", 1)], 2);
    const periodSource = data.matrix!.columns.levels[0]!.sources[0]!;
    data.matrix!.columns = {
        levels: [{ sources: [periodSource] }],
        root: {
            children: [
                { level: 0, value: "2026-01", identity: { key: "period-0" } },
                { isSubtotal: true },
                { level: 0, value: "2026-02", identity: { key: "period-1" } }
            ]
        }
    };
    data.matrix!.rows.root.children![0]!.values = {
        0: { value: 100, valueSourceIndex: 0 },
        1: { value: 80, valueSourceIndex: 1 },
        2: { value: 60, valueSourceIndex: 2 },
        3: { value: 999, valueSourceIndex: 0 },
        4: { value: 999, valueSourceIndex: 1 },
        5: { value: 999, valueSourceIndex: 2 },
        6: { value: 200, valueSourceIndex: 0 },
        7: { value: 160, valueSourceIndex: 1 },
        8: { value: 120, valueSourceIndex: 2 }
    };

    const result = convert(data, config(), true);

    assert.deepEqual(
        result.columns.filter(column => column.kind === "value").map(column => [column.period, column.scenario, column.slot]),
        [
            ["2026-01", "Actual", 0], ["2026-01", "Budget", 1], ["2026-01", "Prior", 2],
            ["2026-02", "Actual", 6], ["2026-02", "Budget", 7], ["2026-02", "Prior", 8]
        ]
    );
    assert.deepEqual(getCell(result.rows[0]!, result.columns[7]!).number, { state: "number", value: 200 });
});

test("optional scenarios and no period use the same contract", () => {
    const data = fixture([line("revenue", 1)], 1, ["Actual"]);
    data.matrix!.columns = { root: {}, levels: [] };
    const result = convert(data, config(), true);
    assert.equal(result.columns.length, 1);
    assert.deepEqual(getCell(result.rows[0]!, result.columns[0]!).number, { state: "number", value: 100 });
});

test("duplicate measure query names and duplicate period groups are rejected", () => {
    const measures = fixture();
    measures.matrix!.valueSources[1]!.queryName = measures.matrix!.valueSources[0]!.queryName;
    expectContract(() => convert(measures, config(), true), "Error_Measures");
    const periods = fixture([line("revenue", 1)], 2);
    periods.matrix!.columns.root.children![1]!.value = periods.matrix!.columns.root.children![0]!.value;
    expectContract(() => convert(periods, config(), true), "Error_Columns");
});

test("host collapsed flags are disclosed without a local fetch or fabricated children", () => {
    const data = fixture();
    data.matrix!.rows.root.children![0]!.isCollapsed = true;
    const result = convert(data, config(), true);
    assert.ok(result.issues.some(issue => issue.key === "Status_HostCollapsed"));
    assert.equal(result.rows[0]?.hasChildren, false);
});

test("partial segments and hard cell bounds are disclosed with no invented continuation", () => {
    const lines = Array.from({ length: 1000 }, (_, i) => line(`r${i}`, i));
    const data = fixture(lines, 25);
    data.metadata.segment = {};
    const result = convert(data, config(lines), true);
    assert.equal(result.partial, true);
    assert.equal(result.columns.length, 168);
    assert.ok(result.rows.length * result.columns.length <= LIMITS.cells);
    assert.ok(result.issues.some(issue => issue.key === "Status_Partial"));
    assert.deepEqual(convert(undefined, new Map(), true).issues, [{ key: "Status_Empty" }]);
});

test("local collapse hides delivered descendants without changing parent values or path identities", () => {
    const { data, lines } = hierarchyFixture();
    const result = convert(data, config(lines), true);
    const visible = visibleRows(result.rows, new Set(["profit"]));
    assert.deepEqual(visible.map(row => row.line.id), ["profit", "margin", "customers"]);
    assert.deepEqual(getCell(visible[0]!, result.columns[0]!).number, { state: "number", value: 60 });
    assert.equal(result.rows[1]?.path.length, 2);
    assert.deepEqual(result.rows[1]?.node.identity, { key: "sales" });
    assert.deepEqual(visibleRows(result.rows, new Set()), result.rows);
});

test("highlight values are supplied separately; totals and deltas do not use highlight sums", () => {
    const data = fixture();
    data.matrix!.rows.root.children![0]!.values![0]!.highlight = 12;
    const result = convert(data, config(), true);
    assert.equal(result.hasHighlights, true);
    assert.deepEqual(getCell(result.rows[0]!, result.columns[0]!).highlight, { state: "number", value: 12 });
    assert.deepEqual(getCell(result.rows[0]!, result.columns[3]!).number, { state: "number", value: 20 });
    assert.equal(getCell(result.rows[0]!, result.columns[3]!).highlight, undefined);
});

test("line formatting overrides host cell formatting, which overrides measure format", () => {
    const lines = [line("revenue", 1, { format: undefined })];
    const data = fixture(lines);
    data.matrix!.rows.root.children![0]!.values![0]!.objects = { general: { formatString: "0.000%" } };
    const result = convert(data, config(lines), true);
    assert.equal(getCell(result.rows[0]!, result.columns[0]!).format, "0.000%");
    result.rows[0]!.line.format = "0.0%";
    assert.equal(getCell(result.rows[0]!, result.columns[0]!).format, "0.0%");
});

test("documented offline P&L inputs satisfy the live metadata and hierarchical matrix contract", () => {
    const { data, lines } = sampleFixture();
    const result = convert(data, config(lines), true);
    assert.equal(result.rows.length, 18);
    assert.equal(result.columns.length, 21);
    assert.equal(result.partial, false);
    const revenue = result.rows.find(row => row.line.id === "pl.revenue")!;
    assert.deepEqual(getCell(revenue, result.columns[0]!).number, { state: "number", value: 126200 });
    const materials = result.rows.find(row => row.line.id === "pl.materials")!;
    assert.deepEqual(getCell(materials, result.columns[3]!).number, { state: "number", value: -3000 });
    assert.equal(getCell(materials, result.columns[3]!).favorable, "unfavorable");
});

test("metadata rejects duplicate JSON property tokens, including escaped spelling, with indexed diagnostics", () => {
    const original = JSON.stringify([line("revenue", 1)]);
    expectContract(() => parseLines(original.replace('"sign":1', '"sign":1,"sign":-1')), "Error_DuplicateProperty");
    expectContract(() => parseLines(original.replace('"sign":1', '"sign":1,"s\\u0069gn":-1')), "Error_DuplicateProperty");
    assert.throws(() => parseLines(JSON.stringify([line("ok", 1), { ...line("bad", 2), sign: 7, formula: "never run" }])),
        error => error instanceof ContractError && error.detail.includes("[2] bad") && error.detail.includes("sign") && error.detail.includes("unknown formula"));
    const quoted = line("safe", 1, { label: '"id": fake, braces } { and escaped \\ text' });
    assert.equal(parseLines(JSON.stringify([quoted])).get("safe")?.label, quoted.label);
});

test("equivalent host subtotal values merge by slot, not JSON serialization or property insertion order", () => {
    const { data, lines } = hierarchyFixture();
    const parent = data.matrix!.rows.root.children![2]!;
    parent.values = { 0: { valueSourceIndex: 0, value: 60 } };
    parent.children!.push({ isSubtotal: true, values: { 0: { value: 60 }, 1: { value: 50, valueSourceIndex: 1 }, 2: { value: 40, valueSourceIndex: 2 } } });
    const result = convert(data, config(lines), true);
    assert.deepEqual(getCell(result.rows[0]!, result.columns[1]!).number, { state: "number", value: 50 });
    parent.values = {};
    const emptyContainer = convert(data, config(lines), true);
    assert.deepEqual(getCell(emptyContainer.rows[0]!, emptyContainer.columns[0]!).number, { state: "number", value: 60 });
});

test("missing modern group values cannot silently fall back to a stale legacy Line ID", () => {
    const data = fixture();
    data.matrix!.rows.root.children![0]!.levelValues = [{ levelSourceIndex: 0 }];
    expectContract(() => convert(data, config(), true), "Error_LineId");
});

test("undefined and nonfinite comparisons never receive favorable/unfavorable coloring", () => {
    const data = fixture();
    data.matrix!.rows.root.children = [node("revenue", [10, 0, Number.MAX_VALUE])];
    const result = convert(data, config(), true);
    const zero = getCell(result.rows[0]!, result.columns[4]!);
    assert.equal(zero.number.state, "zeroReference");
    assert.equal(zero.favorable, "neutral");
    result.rows[0]!.values![0]!.value = Number.MAX_VALUE;
    result.rows[0]!.values![1]!.value = -Number.MAX_VALUE;
    const overflow = getCell(result.rows[0]!, result.columns[3]!);
    assert.equal(overflow.number.state, "invalid");
    assert.equal(overflow.favorable, "neutral");
});

test("unpopulated Desktop host matrix with subtotal-only root and empty columns yields Status_Empty not Error_Columns", () => {
    const data = fixture();
    data.matrix!.rows.root.children = [{ level: 0, isSubtotal: true, values: {} }];
    data.matrix!.columns.root = {};
    const result = convert(data, config(), true);
    assert.deepEqual(result.issues, [{ key: "Status_Empty" }]);
    assert.equal(result.rows.length, 0);
    assert.equal(result.columns.length, 0);
});

test("period-mapped matrix with childless column root yields Status_Empty not Error_Columns", () => {
    const data = fixture();
    data.matrix!.columns.root = {};
    const result = convert(data, config(), true);
    assert.deepEqual(result.issues, [{ key: "Status_Empty" }]);
    assert.equal(result.rows.length, 0);
    assert.equal(result.columns.length, 0);
});

test("malformed nonempty period and source shapes strictly throw Error_Columns rather than mask as empty", () => {
    const outOfRange = fixture();
    outOfRange.matrix!.columns.root.children![0]!.children = [{ level: 1, levelSourceIndex: 99 }];
    expectContract(() => convert(outOfRange, config(), true), "Error_Columns");

    const duplicateSlot = fixture();
    duplicateSlot.matrix!.columns.root.children![0]!.children = [
        { level: 1, levelSourceIndex: 0 },
        { level: 1, levelSourceIndex: 0 }
    ];
    expectContract(() => convert(duplicateSlot, config(), true), "Error_Columns");

    const sourceMismatch = fixture();
    sourceMismatch.matrix!.rows.root.children![0]!.values![0]!.valueSourceIndex = 2;
    expectContract(() => convert(sourceMismatch, config(), true), "Error_Columns");
});
