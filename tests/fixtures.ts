import type powerbi from "powerbi-visuals-api";
import type { Line, Scenario } from "../src/model";

export function line(id: string, order: number, overrides: Partial<Line> = {}): Line {
    return { id, label: id, order, type: "detail", unit: "currency", format: "$#,0;($#,0);$0", sign: 1, favorable: "higher", variance: "both", ...overrides };
}

export function node(id: string, values: (number | null | string)[], level = 0, sources = 3): powerbi.DataViewMatrixNode {
    return {
        level, value: id, levelValues: [{ value: id, levelSourceIndex: 0 }], identity: { key: id },
        values: Object.fromEntries(values.map((value, index) => [index, { value: value ?? undefined, valueSourceIndex: index % sources }]))
    };
}

export function fixture(lines: Line[] = [line("revenue", 1)], periods = 1, roles: Scenario[] = ["Actual", "Budget", "Prior"]): powerbi.DataView {
    const sources: powerbi.DataViewMetadataColumn[] = roles.map(role => ({ displayName: role, queryName: `Measures.${role}`, roles: { [role]: true }, isMeasure: true, type: { numeric: true }, format: "#,0.00" }));
    const rowSource: powerbi.DataViewMetadataColumn = { displayName: "Line ID", queryName: "Lines.ID", roles: { Lines: true }, type: { text: true } };
    const periodSource: powerbi.DataViewMetadataColumn = { displayName: "Period", queryName: "Period.Month", roles: { Period: true }, type: { text: true } };
    return {
        metadata: { columns: [rowSource, periodSource, ...sources], objects: { statement: { lines: JSON.stringify(lines), variances: true, direction: false } } },
        matrix: {
            rows: { levels: [{ sources: [rowSource] }], root: { children: lines.map((item, i) => node(item.id, Array.from({ length: periods * roles.length }, (_, j) => (i + 1) * 100 - (j % roles.length) * 20), 0, roles.length)) } },
            columns: {
                levels: [{ sources: [periodSource] }, { sources }],
                root: {
                    children: Array.from({ length: periods }, (_, i) => ({
                        level: 0, value: `2026-${String(i + 1).padStart(2, "0")}`, identity: { key: `period-${i}` },
                        children: roles.map((_, index) => ({ level: 1, levelSourceIndex: index }))
                    }))
                }
            },
            valueSources: sources
        }
    };
}

export function hierarchyFixture(): { data: powerbi.DataView; lines: Line[] } {
    const lines = [
        line("profit", 1, { label: "Gross profit", type: "subtotal" }),
        line("sales", 1, { label: "Revenue" }),
        line("cost", 2, { label: "Cost of sales", sign: -1, favorable: "lower" }),
        line("margin", 2, { label: "Gross margin", unit: "percent", format: "0.0%", variance: "absolute" }),
        line("customers", 3, { label: "Distinct customers", unit: "number", format: "#,0", variance: "none" })
    ];
    const data = fixture(lines);
    const parent = node("profit", [60, 50, 40]);
    parent.children = [node("cost", [-40, -45, -50], 1), node("sales", [100, 95, 90], 1)];
    data.matrix!.rows.root.children = [node("customers", [7, 8, 6]), node("margin", [0.6, 50 / 95, 40 / 90]), parent];
    data.matrix!.rows.levels.push({ sources: [{ displayName: "Account ID", queryName: "Lines.AccountID", roles: { Lines: true } }] });
    return { data, lines };
}
