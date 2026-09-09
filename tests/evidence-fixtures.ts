import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseLines } from "../src/model";
import { fixture, node } from "./fixtures";
import { sampleFixture } from "./sampleFixture";

export function listingFixture(kind: "pnl" | "balance" | "cashflow") {
    if (kind === "pnl") {
        const { data } = sampleFixture();
        data.matrix!.columns.root.children = data.matrix!.columns.root.children!.slice(0, 1);
        return data;
    }
    const filename = kind === "balance" ? "balance-line-metadata.json" : "cash-flow-line-metadata.json";
    const lines = [...parseLines(readFileSync(join("samples", "patterns", filename), "utf8")).values()];
    const data = fixture(lines, 1);
    data.matrix!.columns.root.children![0]!.value = "Jan 2025";
    const csv = readFileSync(join("samples", "patterns", "expected-results.csv"), "utf8").trim().split(/\r?\n/).map(row => row.split(","));
    const header = csv[0]!;
    const results = csv.slice(1).filter(row => row[0] === "202501");
    const result = (field: string, scenario: string) => {
        const row = results.find(row => row[1] === scenario);
        const column = header.indexOf(field);
        if (!row || column < 0) throw new Error(`Missing checked sample result ${scenario}/${field}`);
        return Number(row[column]);
    };
    const mappings: Record<string, string> = kind === "balance"
        ? { "bs.assets": "Assets", "bs.liabilities-equity": "LiabilitiesAndEquity", "bs.check": "BalanceCheck" }
        : { "cf.opening": "Opening", "cf.operating": "Operating", "cf.investing": "Investing", "cf.financing": "Financing", "cf.net": "Net", "cf.closing": "Closing", "cf.check": "CashBridgeCheck" };
    const accounts: Record<string, string> = {
        "bs.cash": "CASH", "bs.receivables": "RECEIVABLE", "bs.inventory": "INVENTORY",
        "bs.fixed-assets": "FIXED_ASSETS", "bs.payables": "PAYABLE", "bs.debt": "DEBT", "bs.equity": "EQUITY"
    };
    const literals = Array.from(readFileSync(join("samples", "patterns", "BalanceFact.pq"), "utf8").matchAll(/^\s*\{([^{}\r\n]+)\},?\s*$/gm))
        .map(match => JSON.parse(`[${match[1]}]`) as (string | number)[]);
    data.matrix!.rows.root.children = lines.map(line => node(line.id, ["Actual", "Budget", "Prior"].map((scenario, index) => {
        const field = mappings[line.id];
        if (field) return result(field, scenario);
        const source = literals.find(row => row[0] === 202501 && row[1] === accounts[line.id]);
        if (!source || typeof source[index + 2] !== "number") throw new Error(`Missing literal sample account ${line.id}`);
        return Number(source[index + 2]);
    })));
    return data;
}
