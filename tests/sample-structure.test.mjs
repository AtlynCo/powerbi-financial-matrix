import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { sampleStructureIssues } from "../scripts/sample-structure.mjs";

function sample(t) {
  mkdirSync(".tmp", { recursive: true });
  const root = mkdtempSync(join(resolve(".tmp"), "sample-structure-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync("samples/pbip", root, { recursive: true });
  return root;
}
const versionPath = root => join(root, "AtlynFinancialMatrix.Report", "definition", "version.json");

test("complete authored sample has required PBIR files and a distinct report-format version", t => {
  const root = sample(t);
  assert.deepEqual(sampleStructureIssues(root), []);
  assert.equal(JSON.parse(readFileSync(versionPath(root), "utf8")).version, "2.0.0");
});

test("missing version.json fails even when every remaining JSON file could validate", t => {
  const root = sample(t);
  rmSync(versionPath(root));
  assert.ok(sampleStructureIssues(root).some(issue => issue.includes("version.json")));
});

test("visual version is not substituted for the PBIR report-definition version", t => {
  const root = sample(t);
  const version = JSON.parse(readFileSync(versionPath(root), "utf8"));
  version.version = "1.0.0.0";
  writeFileSync(versionPath(root), JSON.stringify(version));
  assert.ok(sampleStructureIssues(root).some(issue => issue.includes("report definition version 2.0.0")));
});

test("version metadata must use the matching schema and a non-null object", t => {
  const root = sample(t);
  writeFileSync(versionPath(root), JSON.stringify({ $schema: "wrong-schema", version: "2.0.0" }));
  assert.ok(sampleStructureIssues(root).some(issue => issue.includes("versionMetadata/1.0.0")));
  writeFileSync(versionPath(root), "null");
  assert.ok(sampleStructureIssues(root).some(issue => issue.includes("versionMetadata/1.0.0")));
});

test("legacy PBIR entry version cannot stand in for the enhanced report layout", t => {
  const root = sample(t);
  const entryPath = join(root, "AtlynFinancialMatrix.Report", "definition.pbir");
  const entry = JSON.parse(readFileSync(entryPath, "utf8"));
  entry.version = "1.0";
  writeFileSync(entryPath, JSON.stringify(entry));
  assert.ok(sampleStructureIssues(root).some(issue => issue.includes("definition.pbir version 4.0")));
});

test("a directory named version.json is not a required metadata file", t => {
  const root = sample(t);
  rmSync(versionPath(root));
  mkdirSync(versionPath(root));
  assert.ok(sampleStructureIssues(root).some(issue => issue.includes("version.json")));
});

test("a page listed in pages.json must have its own page definition", t => {
  const root = sample(t);
  rmSync(join(root, "AtlynFinancialMatrix.Report", "definition", "pages", "CashFlow", "page.json"));
  assert.ok(sampleStructureIssues(root).some(issue => issue.includes("CashFlow")));
});
