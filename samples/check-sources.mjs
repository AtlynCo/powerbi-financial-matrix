// Literal-source/arithmetic checks only: this is not an M or DAX interpreter.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (relative) => readFileSync(path.join(root, ...relative.split(/[\\/]/)), "utf8");
const json = (relative) => JSON.parse(read(relative));
const visual = JSON.parse(readFileSync(path.join(root, "..", "pbiviz.json"), "utf8")).visual;
const scenarios = ["Actual", "Budget", "Prior"];
let checks = 0;

function equal(actual, expected, message) {
    assert.deepEqual(actual, expected, message);
    checks++;
}

function close(actual, expected, message) {
    if (actual === null || expected === null) {
        equal(actual, expected, message);
        return;
    }
    assert.ok(Number.isFinite(actual) && Number.isFinite(expected), message);
    assert.ok(Math.abs(actual - expected) <= 1e-10 * Math.max(1, Math.abs(expected)), message);
    checks++;
}

function literalRows(relative) {
    const source = read(relative);
    assert.ok(!/\b(?:Web|File|Folder|Sql|OData)\./i.test(source), `${relative}: external source`);
    const rows = [...source.matchAll(/^\s*\{([^{}\r\n]+)\},?\s*$/gm)]
        .map((match) => JSON.parse(`[${match[1]}]`));
    assert.ok(rows.length > 0, `${relative}: no supported literal rows`);
    return rows;
}

function csv(relative) {
    const [header, ...lines] = read(relative).trim().split(/\r?\n/);
    const keys = header.split(",");
    return lines.map((line) => {
        const cells = line.split(",");
        equal(cells.length, keys.length, `${relative}: CSV width`);
        return Object.fromEntries(keys.map((key, index) => [key, cells[index]]));
    });
}

function numeric(value) {
    if (value === "") return null;
    const result = Number(value);
    assert.ok(Number.isFinite(result), `Expected numeric literal, got ${value}`);
    return result;
}

const periodRows = literalRows("pnl\\Period.pq");
const periods = periodRows.map((row) => row[0]);
equal(periods, [202501, 202502, 202503], "Period keys");
equal(periodRows.map((row) => row[2]), [1, 2, 3], "Dense chronological PeriodSort");
const accounts = literalRows("pnl\\Accounts.pq");
const facts = literalRows("pnl\\Facts.pq");
const statement = literalRows("pnl\\StatementLines.pq");
const balances = literalRows("patterns\\BalanceFact.pq");
const cashFlows = literalRows("patterns\\CashFlowFact.pq");
const balanceLines = literalRows("patterns\\BalanceLines.pq");
const cashLines = literalRows("patterns\\CashFlowLines.pq");
equal(accounts.length, 8, "Accounts count");
equal(facts.length, 30, "P&L seed count");
equal(statement.length, 13, "P&L leaf count");
equal(balances.length, 21, "Balance seed count");
equal(cashFlows.length, 12, "Cash-flow seed count");
equal(facts.reduce((count, row) => count + row.slice(3).filter((value) => value !== null).length, 0), 87, "P&L unpivot non-null count");
equal(balances.length * 3, 63, "Balance long count");
equal(cashFlows.length * 3, 36, "Cash-flow long count");

const accountIDs = new Set(accounts.map((row) => row[0]));
equal(accountIDs.size, accounts.length, "Unique account keys");
for (const row of facts) {
    equal(row.length, 6, "P&L literal row width");
    assert.ok(periods.includes(row[0]) && accountIDs.has(row[1]), "Fact dimension keys");
    for (const value of row.slice(3)) assert.ok(value === null || Number.isFinite(value), "Numeric fact");
}
for (const [name, rows] of [["Balance", balances], ["Cash flow", cashFlows]]) {
    for (const row of rows) {
        equal(row.length, 5, `${name} literal row width`);
        assert.ok(periods.includes(row[0]), `${name}: unknown period`);
        for (const value of row.slice(2)) assert.ok(Number.isFinite(value), `${name}: numeric fact`);
    }
    equal(new Set(rows.map((row) => `${row[0]}:${row[1]}`)).size, rows.length, `${name}: unique fact grain`);
}

function metadata(relative, daxRelative, nodes) {
    const source = read(relative);
    assert.ok(source.length <= 256000, `${relative}: JSON length`);
    const entries = JSON.parse(source);
    assert.ok(Array.isArray(entries) && entries.length <= 1000);
    const ids = new Set();
    const siblingOrders = new Set();
    const parents = new Map(nodes.map((node) => [node.id, node.parent]));
    equal(parents.size, nodes.length, `${relative}: globally unique delivered IDs`);
    for (const entry of entries) {
        assert.ok(typeof entry.id === "string" && entry.id.length > 0 && entry.id.length <= 100);
        assert.ok(typeof entry.label === "string" && entry.label.length > 0 && entry.label.length <= 200);
        assert.ok(!ids.has(entry.id), `${relative}: duplicate ID ${entry.id}`);
        assert.ok(Number.isInteger(entry.order));
        assert.ok(["detail", "subtotal", "heading"].includes(entry.type));
        assert.ok(["currency", "percent", "number"].includes(entry.unit));
        assert.ok([1, -1].includes(entry.sign));
        assert.ok(["higher", "lower", "neutral"].includes(entry.favorable));
        assert.ok(["none", "absolute", "both"].includes(entry.variance));
        assert.ok(typeof entry.format === "string" && entry.format.length > 0 && entry.format.length <= 100, "Sample requires explicit format");
        if (entry.unit === "percent") assert.notEqual(entry.variance, "both");
        if (entry.type === "heading") equal(entry.variance, "none", "Heading opt-out");
        const siblingKey = `${parents.get(entry.id)}:${entry.order}`;
        assert.ok(!siblingOrders.has(siblingKey), `${relative}: duplicate sibling order`);
        siblingOrders.add(siblingKey);
        ids.add(entry.id);
    }
    equal([...ids].sort(), nodes.map((node) => node.id).sort(), `${relative}: exact node coverage`);
    for (const node of nodes) {
        equal(entries.find((entry) => entry.id === node.id).order, node.order, `${node.id}: metadata/source order`);
    }
    const dax = read(daxRelative);
    const daxIDs = [...new Set([...dax.matchAll(/"((?:pl|bs|cf)\.[^"]+)"/g)].map((match) => match[1]))];
    equal(daxIDs.sort(), [...ids].sort(), `${daxRelative}: explicit SWITCH ID coverage`);
    assert.ok(dax.includes("ISINSCOPE"), `${daxRelative}: scope-aware measure`);
    assert.ok(!/\bFORMAT\s*\(/i.test(dax), `${daxRelative}: numeric, not text measures`);
    assert.ok(!/\bSUMX\s*\(\s*'(?:StatementLines|BalanceLines|CashFlowLines)'/i.test(dax), "Never sum statement rows");
    return new Map(entries.map((entry) => [entry.id, entry]));
}

const sections = [...new Map(statement.map((row) => [row[0], row[1]])).entries()];
const pnlNodes = [
    ...sections.map(([id, order]) => ({ id, order, parent: null })),
    ...statement.map(([parent, , id, order]) => ({ id, order, parent }))
];
for (const [id, order] of sections) {
    assert.ok(statement.filter((row) => row[0] === id).every((row) => row[1] === order));
}
const pnlMetadata = metadata("pnl\\line-metadata.json", "pnl\\Statement-measures.dax", pnlNodes);
const bsMetadata = metadata("patterns\\balance-line-metadata.json", "patterns\\Balance-measures.dax",
    balanceLines.map(([id, order]) => ({ id, order, parent: null })));
const cfMetadata = metadata("patterns\\cash-flow-line-metadata.json", "patterns\\CashFlow-measures.dax",
    cashLines.map(([id, order]) => ({ id, order, parent: null })));
equal(new Set([...pnlMetadata.keys(), ...bsMetadata.keys(), ...cfMetadata.keys()]).size, 35, "Unique IDs across sample pages");

function sumFacts(rows, selectedPeriods, ids, valueIndex) {
    const selected = rows.filter((row) =>
        selectedPeriods.includes(row[0]) && ids.includes(row[1]) && row[valueIndex] !== null);
    return selected.length ? selected.reduce((sum, row) => sum + row[valueIndex], 0) : null;
}

function pnl(selectedPeriods, scenarioIndex) {
    const index = scenarioIndex + 3;
    const sum = (ids) => sumFacts(facts, selectedPeriods, ids, index);
    const revenue = sum(["PRODUCT", "SERVICE", "LAUNCH"]);
    const costs = sum(["MATERIALS", "DELIVERY"]);
    const expenses = sum(["PAYROLL", "OCCUPANCY", "MARKETING"]);
    const customers = new Set(facts.filter((row) =>
        selectedPeriods.includes(row[0]) && ["PRODUCT", "SERVICE", "LAUNCH"].includes(row[1])
        && row[2] !== null && row[index] !== null && row[index] !== 0).map((row) => row[2])).size;
    return {
        "pl.revenue": revenue, "pl.product-revenue": sum(["PRODUCT"]),
        "pl.service-revenue": sum(["SERVICE"]), "pl.launch-revenue": sum(["LAUNCH"]),
        "pl.cost-of-sales": costs, "pl.materials": sum(["MATERIALS"]), "pl.delivery": sum(["DELIVERY"]),
        "pl.gross": null, "pl.gross-profit": revenue - costs, "pl.gross-margin": (revenue - costs) / revenue,
        "pl.operating-expenses": expenses, "pl.payroll": sum(["PAYROLL"]),
        "pl.occupancy": sum(["OCCUPANCY"]), "pl.marketing": sum(["MARKETING"]),
        "pl.results": null, "pl.operating-profit": revenue - costs - expenses,
        "pl.operating-margin": (revenue - costs - expenses) / revenue, "pl.customers": customers
    };
}

const expectedPnL = csv("pnl\\expected-results.csv");
equal(expectedPnL.length, 54, "P&L expected node/period count");
equal(new Set(expectedPnL.map((row) => `${row.PeriodKey}:${row.LineID}`)).size, 54, "Unique expected node/period keys");
for (const row of expectedPnL) {
    assert.ok(periods.includes(Number(row.PeriodKey)) && pnlMetadata.has(row.LineID));
    scenarios.forEach((scenario, index) =>
        close(pnl([Number(row.PeriodKey)], index)[row.LineID], numeric(row[scenario]), `${row.PeriodKey}/${row.LineID}/${scenario}`));
}
scenarios.forEach((scenario, index) => {
    equal(pnl(periods, index)["pl.customers"], 4, `${scenario}: all-month distinct count`);
    equal(periods.reduce((sum, period) => sum + pnl([period], index)["pl.customers"], 0), 9, `${scenario}: unsafe summed counts differ`);
});

for (const row of csv("pnl\\expected-variances.csv")) {
    const entry = pnlMetadata.get(row.LineID);
    const actualRaw = pnl([Number(row.PeriodKey)], 0)[row.LineID];
    const referenceRaw = pnl([Number(row.PeriodKey)], scenarios.indexOf(row.Reference))[row.LineID];
    const actual = actualRaw === null ? null : actualRaw * entry.sign;
    const reference = referenceRaw === null ? null : referenceRaw * entry.sign;
    const delta = actual === null || reference === null ? null : actual - reference;
    close(actual, numeric(row.DisplayActual), `${row.LineID}: displayed actual`);
    close(reference, numeric(row.DisplayReference), `${row.LineID}: displayed reference`);
    close(delta === null ? null : delta * (entry.unit === "percent" ? 100 : 1),
        numeric(row.AbsoluteVariance), `${row.LineID}: absolute variance`);
    const relative = entry.variance !== "both" || delta === null ? null
        : reference === 0 ? "N/A" : delta / Math.abs(reference);
    if (relative === "N/A") equal(relative, row.RelativeVariance, "Zero-reference relative variance");
    else close(relative, numeric(row.RelativeVariance), `${row.LineID}: relative variance`);
    const favorable = delta === null ? "missing" : delta === 0 || entry.favorable === "neutral" ? "neutral"
        : (delta > 0) === (entry.favorable === "higher") ? "favorable" : "unfavorable";
    equal(favorable, row.Favorability, `${row.LineID}: displayed-delta favorability`);
    equal(entry.unit === "percent" ? "percentage-points" : entry.unit, row.AbsoluteUnit, "Absolute variance unit");
}

const expectedPatterns = csv("patterns\\expected-results.csv");
equal(expectedPatterns.length, 9, "Pattern period/scenario count");
equal(new Set(expectedPatterns.map((row) => `${row.PeriodKey}:${row.Scenario}`)).size, 9, "Unique pattern expected keys");
for (const row of expectedPatterns) {
    const period = Number(row.PeriodKey);
    const scenarioIndex = scenarios.indexOf(row.Scenario);
    assert.ok(periods.includes(period) && scenarioIndex >= 0);
    const index = scenarioIndex + 2;
    const balance = (ids) => sumFacts(balances, [period], ids, index);
    const flow = (ids) => sumFacts(cashFlows, [period], ids, index);
    const assets = balance(["CASH", "RECEIVABLE", "INVENTORY", "FIXED_ASSETS"]);
    const liabilities = balance(["PAYABLE", "DEBT", "EQUITY"]);
    const opening = flow(["Opening"]);
    const net = flow(["Operating", "Investing", "Financing"]);
    const closing = balance(["CASH"]);
    const result = {
        Assets: assets, LiabilitiesAndEquity: liabilities, Opening: opening,
        Operating: flow(["Operating"]), Investing: flow(["Investing"]), Financing: flow(["Financing"]),
        Net: net, Closing: closing, BalanceCheck: assets - liabilities, CashBridgeCheck: opening + net - closing
    };
    for (const [key, value] of Object.entries(result)) close(value, numeric(row[key]), `${period}/${row.Scenario}/${key}`);
    if (period !== periods[0]) {
        close(opening, sumFacts(balances, [periods[periods.indexOf(period) - 1]], ["CASH"], index), "Opening equals prior closing");
    }
}
scenarios.forEach((scenario, index) => {
    const opening = sumFacts(cashFlows, [periods[0]], ["Opening"], index + 2);
    const net = sumFacts(cashFlows, periods, ["Operating", "Investing", "Financing"], index + 2);
    const closing = sumFacts(balances, [periods.at(-1)], ["CASH"], index + 2);
    equal(net, [28000, 24000, 9000][index], `${scenario}: selected-period movements`);
    equal(closing, [73000, 70000, 46000][index], `${scenario}: ending snapshot, not summed balances`);
    close(opening + net, closing, `${scenario}: contiguous combined bridge`);
});

const recipe = json("report-layout.json");
equal(recipe.notPowerBIImportFormat, true, "Recipe is not an importable report");
equal(recipe.desktopValidated, false, "No Desktop-validation claim");
equal(recipe.visualGuid, visual.guid, "Current visual GUID");
equal(recipe.visualVersion, visual.version, "Current visual version");
for (const item of [...recipe.queries, ...recipe.measureSources]) {
    assert.ok(!path.isAbsolute(item.source) && !item.source.split(/[\\/]/).includes(".."), "Portable sample-relative source");
    read(item.source);
}
for (const page of recipe.pages) {
    read(page.lineMetadataSource);
    assert.ok(page.roles.Lines.length >= 1 && page.roles.Lines.length <= 6);
    equal(page.roles.Actual.length, 1, `${page.name}: actual binding`);
    assert.ok(!JSON.stringify(page.roles).includes("[Scenario]"), "Scenario measures, not grouping");
}
console.log(`Sample source consistency passed (${checks} assertions; P&L, BS, CF, metadata and recipe).`);
console.log("M/DAX engines and Power BI Desktop/service were NOT executed or validated.");
