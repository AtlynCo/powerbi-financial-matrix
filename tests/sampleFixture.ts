import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseLines } from "../src/model";
import { fixture, node } from "./fixtures";

// Authoritative expected inputs for presentation tests, not an M/DAX engine.
export function sampleFixture() {
    const read = (file: string) => readFileSync(join("samples", "pnl", file), "utf8");
    const lines = [...parseLines(read("line-metadata.json")).values()];
    const data = fixture(lines, 3);
    const captions = [...read("Period.pq").matchAll(/\{\d+,\s*"([^"]+)",\s*\d+\}/g)].map(match => match[1]!);
    if (captions.length !== 3) throw new Error("Sample period shape changed; update the presentation fixture explicitly.");
    data.matrix!.columns.root.children!.forEach((column, index) => { column.value = captions[index]; column.identity = { key: captions[index] }; });
    data.matrix!.rows.levels[0]!.sources[0]!.queryName = "StatementLines.SectionID";
    const rows = read("expected-results.csv").trim().split(/\r?\n/).slice(1).map(row => row.split(","));
    const values = (id: string) => ["202501", "202502", "202503"].flatMap(period => {
        const entry = rows.find(row => row[0] === period && row[1] === id);
        if (!entry) throw new Error(`Missing expected sample input ${period}/${id}`);
        return entry.slice(2).map(value => value === "" ? null : Number(value));
    });
    const hierarchy = [...read("StatementLines.pq").matchAll(/\{"([^"]+)",\s*\d+,\s*"([^"]+)",\s*\d+\}/g)]
        .map(match => ({ parent: match[1]!, child: match[2]! }));
    if (hierarchy.length !== 13) throw new Error("Sample hierarchy shape changed; update the presentation fixture explicitly.");
    data.matrix!.rows.levels.push({ sources: [{ displayName: "LineID", queryName: "StatementLines.LineID", roles: { Lines: true } }] });
    data.matrix!.rows.root.children = [...new Set(hierarchy.map(entry => entry.parent))].map(id => ({
        ...node(id, values(id)),
        children: hierarchy.filter(entry => entry.parent === id).map(entry => node(entry.child, values(entry.child), 1))
    }));
    return { data, lines };
}
