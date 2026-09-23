// Validates the authored PBIP/PBIR/TMDL sample under samples/pbip/** without executing
// Power BI Desktop, the Power BI service, Power Query, DAX or any network call. Every
// check here is local: JSON Schema conformance (Ajv, against the schemas cached in
// samples/pbip/schema), TMDL <-> canonical M/DAX byte-identity, page/visual metadata
// bindings against capabilities.json and samples/report-layout.json, relationships/sorts
// against samples/README.md and samples/patterns/README.md, and (if scripts/build-sample.mjs
// has already run) the embedded custom-visual resource's GUID/version/SHA-256 against the
// real dist/*.pbiviz artifact.
//
// This script cannot and does not claim: Power BI Desktop open/refresh, a saved .pbix,
// native rendering, or Fabric/service validation. See docs/PBIP-SAMPLE.md.
//
// Usage:  node scripts/validate-sample.mjs
import Ajv from "ajv";
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readArtifact } from "./artifact.mjs";
import { sampleStructureIssues } from "./sample-structure.mjs";

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SAMPLES = path.join(REPO_ROOT, "samples");
const PBIP = path.join(SAMPLES, "pbip");
const SCHEMA_DIR = path.join(PBIP, "schema");
const REPORT_DIR = path.join(PBIP, "AtlynFinancialMatrix.Report");
const MODEL_DIR = path.join(PBIP, "AtlynFinancialMatrix.SemanticModel");
const TABLES_DIR = path.join(MODEL_DIR, "definition", "tables");

const { guid: RESOURCE_GUID, version: RESOURCE_VERSION } = readJson(path.join(REPO_ROOT, "pbiviz.json")).visual;

const results = [];
function record(status, name, detail) {
  results.push({ status, name, detail });
}
function pass(name, detail) {
  record("PASS", name, detail);
}
function fail(name, detail) {
  record("FAIL", name, detail);
}
function warn(name, detail) {
  record("WARN", name, detail);
}
function assertCheck(name, condition, detail) {
  if (condition) pass(name, detail);
  else fail(name, detail);
}

function readText(p) {
  return readFileSync(p, "utf8").replace(/\r\n/g, "\n");
}
function readJson(p) {
  return JSON.parse(readText(p));
}
function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const sourceStructureIssues = sampleStructureIssues(PBIP);
assertCheck("source-required-files", sourceStructureIssues.length === 0, sourceStructureIssues.join("; ") || "Required project/PBIR/TMDL entry files are present");

// ---------------------------------------------------------------------------
// 1. JSON Schema conformance (Ajv, draft-07, all schemas cached locally offline)
// ---------------------------------------------------------------------------
// Two of the primary Microsoft schema files declare an internal `$id` that does not match
// the literal relative `$ref` path other schemas use to point at them (an upstream naming
// quirk, confirmed by fetching the published files directly: both a `schema.embedded.json`
// $id and a same-content `schema-embedded.json` URL exist for filterConfiguration and
// visualConfiguration). Register each such schema under both keys so $ref resolution works
// without editing any cached schema's own declared $id.
const REF_ALIASES = {
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/filterConfiguration/1.3.0/schema.embedded.json":
    "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/filterConfiguration/1.3.0/schema-embedded.json",
  "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualConfiguration/2.3.0/schema.embedded.json":
    "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualConfiguration/2.3.0/schema-embedded.json",
};

const ajv = new Ajv({ allErrors: true, strict: false });
if (!existsSync(SCHEMA_DIR)) {
  fail("schema-cache-present", `missing ${SCHEMA_DIR}; run the schema download step before validating`);
} else {
  const schemaFiles = readdirSync(SCHEMA_DIR).filter((f) => f.endsWith(".json"));
  for (const f of schemaFiles) {
    const schema = readJson(path.join(SCHEMA_DIR, f));
    ajv.addSchema(schema);
    const alias = REF_ALIASES[schema.$id];
    if (alias) ajv.addSchema(schema, alias);
  }
  pass("schema-cache-loaded", `${schemaFiles.length} schema files registered`);

  // Every JSON-bearing file under samples/pbip (excluding the schema cache itself) that
  // declares a $schema must validate against that schema. This covers .json/.pbir/.pbism/
  // .pbip/.platform uniformly (a leading-dot-only filename like ".platform" has no
  // extension per Node's path.extname, so file names are matched explicitly instead).
  const JSON_BEARING = new Set([".json", ".pbir", ".pbism", ".pbip"]);
  const allFiles = existsSync(PBIP) ? walk(PBIP) : [];
  let validatedCount = 0;
  for (const f of allFiles) {
    if (f.startsWith(SCHEMA_DIR)) continue;
    const base = path.basename(f);
    const isJsonBearing = JSON_BEARING.has(path.extname(f)) || base === ".platform";
    if (!isJsonBearing) continue;
    const rel = path.relative(REPO_ROOT, f);
    let data;
    try {
      data = readJson(f);
    } catch (err) {
      fail(`schema:${rel}`, `not valid JSON: ${err.message}`);
      continue;
    }
    if (!data.$schema) {
      warn(`schema:${rel}`, "no $schema property present; skipped schema validation");
      continue;
    }
    const validator = ajv.getSchema(data.$schema);
    if (!validator) {
      fail(`schema:${rel}`, `no cached schema registered for ${data.$schema}`);
      continue;
    }
    const valid = validator(data);
    validatedCount += 1;
    assertCheck(`schema:${rel}`, valid, valid ? "conforms" : JSON.stringify(validator.errors));
  }
  pass("schema-validated-file-count", `${validatedCount} files checked against a cached schema`);
}

// ---------------------------------------------------------------------------
// 2. TMDL <-> canonical M/DAX byte-identity (central sample sources stay authoritative)
// ---------------------------------------------------------------------------
// Rebuilds the exact expected TMDL text for every table from the same canonical .pq/.dax
// files under samples/pnl and samples/patterns, using the same fencing/measure-splitting
// rules the authored files were generated with, then compares byte-for-byte (after
// normalizing CRLF only) against what is actually checked in. Any drift between the
// canonical sample sources and the TMDL model fails loudly here.
function tabs(n) {
  return "\t".repeat(n);
}
function fence(text, baseIndent) {
  const body = text
    .replace(/\n+$/, "")
    .split("\n")
    .map((l) => (l.length ? tabs(baseIndent) + l : ""))
    .join("\n");
  return "```\n" + body + "\n" + tabs(baseIndent) + "```";
}
function quoteIfNeeded(name) {
  return /[\s.=:']/.test(name) ? `'${name.replace(/'/g, "''")}'` : name;
}
function splitMeasures(raw, names) {
  const marks = names.map((name) => {
    const marker = `\n${name} =\n`;
    const idx = raw.indexOf(marker);
    if (idx === -1) throw new Error(`Measure header not found: ${name}`);
    return { name, headerStart: idx + 1, bodyStart: idx + marker.length };
  });
  return marks.map((m, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].headerStart : raw.length;
    const body = raw.slice(m.bodyStart, end).replace(/^\n+/, "").replace(/\n+$/, "");
    return { name: m.name, body };
  });
}
function col(name, dataType, opts = {}) {
  const lines = [`\tcolumn ${quoteIfNeeded(name)}`];
  lines.push(`\t\tdataType: ${dataType}`);
  if (opts.formatString) lines.push(`\t\tformatString: ${opts.formatString}`);
  lines.push(`\t\tsourceColumn: ${opts.sourceColumn || name}`);
  lines.push(`\t\tsummarizeBy: ${opts.summarizeBy || "none"}`);
  if (opts.sortByColumn) lines.push(`\t\tsortByColumn: ${quoteIfNeeded(opts.sortByColumn)}`);
  if (opts.isHidden) lines.push("\t\tisHidden");
  return lines.join("\n");
}
function measureBlock(name, body, opts = {}) {
  const decl = `\tmeasure ${quoteIfNeeded(name)} = ${fence(body, 2)}`;
  const props = [];
  if (opts.formatString) props.push(`\t\tformatString: ${opts.formatString}`);
  if (opts.isHidden) props.push("\t\tisHidden");
  return [decl, ...props].join("\n");
}
function partitionBlock(tableName, mQuery) {
  return [`\tpartition ${quoteIfNeeded(tableName)} = m`, "\t\tmode: import", `\t\tsource = ${fence(mQuery, 3)}`].join(
    "\n"
  );
}
function expectedTableText(tableName, blocks) {
  return `table ${quoteIfNeeded(tableName)}\n\n` + blocks.join("\n\n") + "\n";
}

function buildExpectedTables() {
  const expected = {};

  const periodM = readText(path.join(SAMPLES, "pnl", "Period.pq"));
  expected["Period.tmdl"] = expectedTableText("Period", [
    col("PeriodKey", "int64"),
    col("Period", "string", { sortByColumn: "PeriodSort" }),
    col("PeriodSort", "int64", { isHidden: true }),
    partitionBlock("Period", periodM),
  ]);

  const accountsM = readText(path.join(SAMPLES, "pnl", "Accounts.pq"));
  expected["Accounts.tmdl"] = expectedTableText("Accounts", [
    col("AccountID", "string"),
    col("AccountLabel", "string"),
    col("StatementClass", "string"),
    partitionBlock("Accounts", accountsM),
  ]);

  {
    const m = readText(path.join(SAMPLES, "pnl", "Facts.pq"));
    const dax = readText(path.join(SAMPLES, "pnl", "Statement-measures.dax"));
    const names = ["Fact Amount", "Statement Value", "Actual", "Budget", "Prior"];
    const byName = Object.fromEntries(splitMeasures(dax, names).map((x) => [x.name, x.body]));
    expected["Facts.tmdl"] = expectedTableText("Facts", [
      measureBlock("Fact Amount", byName["Fact Amount"], { isHidden: true }),
      measureBlock("Statement Value", byName["Statement Value"], { isHidden: true }),
      measureBlock("Actual", byName["Actual"], { formatString: "#,0.00;(#,0.00);0.00" }),
      measureBlock("Budget", byName["Budget"], { formatString: "#,0.00;(#,0.00);0.00" }),
      measureBlock("Prior", byName["Prior"], { formatString: "#,0.00;(#,0.00);0.00" }),
      col("PeriodKey", "int64", { isHidden: true }),
      col("AccountID", "string", { isHidden: true }),
      col("CustomerID", "string", { isHidden: true }),
      col("Scenario", "string", { isHidden: true }),
      col("Amount", "double", { isHidden: true }),
      partitionBlock("Facts", m),
    ]);
  }

  const statementLinesM = readText(path.join(SAMPLES, "pnl", "StatementLines.pq"));
  expected["StatementLines.tmdl"] = expectedTableText("StatementLines", [
    col("SectionID", "string", { sortByColumn: "SectionOrder" }),
    col("SectionOrder", "int64", { isHidden: true }),
    col("LineID", "string", { sortByColumn: "LineOrder" }),
    col("LineOrder", "int64", { isHidden: true }),
    partitionBlock("StatementLines", statementLinesM),
  ]);

  {
    const m = readText(path.join(SAMPLES, "patterns", "BalanceFact.pq"));
    const dax = readText(path.join(SAMPLES, "patterns", "Balance-measures.dax"));
    const names = ["Balance Amount", "Balance at Period End", "Balance Sheet Value", "BS Actual", "BS Budget", "BS Prior"];
    const byName = Object.fromEntries(splitMeasures(dax, names).map((x) => [x.name, x.body]));
    expected["BalanceFact.tmdl"] = expectedTableText("BalanceFact", [
      measureBlock("Balance Amount", byName["Balance Amount"], { isHidden: true }),
      measureBlock("Balance at Period End", byName["Balance at Period End"], { isHidden: true }),
      measureBlock("Balance Sheet Value", byName["Balance Sheet Value"], { isHidden: true }),
      measureBlock("BS Actual", byName["BS Actual"], { formatString: "#,0.00;(#,0.00);0.00" }),
      measureBlock("BS Budget", byName["BS Budget"], { formatString: "#,0.00;(#,0.00);0.00" }),
      measureBlock("BS Prior", byName["BS Prior"], { formatString: "#,0.00;(#,0.00);0.00" }),
      col("PeriodKey", "int64", { isHidden: true }),
      col("AccountID", "string", { isHidden: true }),
      col("Scenario", "string", { isHidden: true }),
      col("Amount", "double", { isHidden: true }),
      partitionBlock("BalanceFact", m),
    ]);
  }

  const balanceLinesM = readText(path.join(SAMPLES, "patterns", "BalanceLines.pq"));
  expected["BalanceLines.tmdl"] = expectedTableText("BalanceLines", [
    col("LineID", "string", { sortByColumn: "LineOrder" }),
    col("LineOrder", "int64", { isHidden: true }),
    partitionBlock("BalanceLines", balanceLinesM),
  ]);

  {
    const m = readText(path.join(SAMPLES, "patterns", "CashFlowFact.pq"));
    const dax = readText(path.join(SAMPLES, "patterns", "CashFlow-measures.dax"));
    const names = ["Cash Flow Amount", "Cash Flow Value", "CF Actual", "CF Budget", "CF Prior"];
    const byName = Object.fromEntries(splitMeasures(dax, names).map((x) => [x.name, x.body]));
    expected["CashFlowFact.tmdl"] = expectedTableText("CashFlowFact", [
      measureBlock("Cash Flow Amount", byName["Cash Flow Amount"], { isHidden: true }),
      measureBlock("Cash Flow Value", byName["Cash Flow Value"], { isHidden: true }),
      measureBlock("CF Actual", byName["CF Actual"], { formatString: "#,0.00;(#,0.00);0.00" }),
      measureBlock("CF Budget", byName["CF Budget"], { formatString: "#,0.00;(#,0.00);0.00" }),
      measureBlock("CF Prior", byName["CF Prior"], { formatString: "#,0.00;(#,0.00);0.00" }),
      col("PeriodKey", "int64", { isHidden: true }),
      col("Movement", "string", { isHidden: true }),
      col("Scenario", "string", { isHidden: true }),
      col("Amount", "double", { isHidden: true }),
      partitionBlock("CashFlowFact", m),
    ]);
  }

  const cashFlowLinesM = readText(path.join(SAMPLES, "patterns", "CashFlowLines.pq"));
  expected["CashFlowLines.tmdl"] = expectedTableText("CashFlowLines", [
    col("LineID", "string", { sortByColumn: "LineOrder" }),
    col("LineOrder", "int64", { isHidden: true }),
    partitionBlock("CashFlowLines", cashFlowLinesM),
  ]);

  return expected;
}

if (!existsSync(TABLES_DIR)) {
  fail("tmdl-tables-present", `missing ${TABLES_DIR}`);
} else {
  const expectedTables = buildExpectedTables();
  const actualFiles = new Set(readdirSync(TABLES_DIR).filter((f) => f.endsWith(".tmdl")));
  for (const [fileName, expectedText] of Object.entries(expectedTables)) {
    const full = path.join(TABLES_DIR, fileName);
    if (!existsSync(full)) {
      fail(`tmdl:${fileName}`, "missing table file");
      continue;
    }
    actualFiles.delete(fileName);
    const actualText = readText(full);
    assertCheck(
      `tmdl:${fileName}`,
      actualText === expectedText,
      actualText === expectedText
        ? "byte-identical to canonical M/DAX (recomputed)"
        : "content differs from samples/pnl or samples/patterns canonical source"
    );
  }
  for (const stray of actualFiles) fail(`tmdl:${stray}`, "unexpected extra table file not derived from a known canonical source");
}

// ---------------------------------------------------------------------------
// 3. relationships.tmdl structural check against samples/README.md + patterns/README.md
// ---------------------------------------------------------------------------
const EXPECTED_RELATIONSHIPS = [
  { from: "Facts.PeriodKey", to: "Period.PeriodKey" },
  { from: "Facts.AccountID", to: "Accounts.AccountID" },
  { from: "BalanceFact.PeriodKey", to: "Period.PeriodKey" },
  { from: "CashFlowFact.PeriodKey", to: "Period.PeriodKey" },
];
const relationshipsPath = path.join(MODEL_DIR, "definition", "relationships.tmdl");
if (!existsSync(relationshipsPath)) {
  fail("relationships-present", "missing relationships.tmdl");
} else {
  const text = readText(relationshipsPath);
  const found = [...text.matchAll(/fromColumn:\s*(\S+)\s*\n\s*toColumn:\s*(\S+)/g)].map((m) => ({
    from: m[1],
    to: m[2],
  }));
  assertCheck(
    "relationships-count",
    found.length === EXPECTED_RELATIONSHIPS.length,
    `found ${found.length}, expected ${EXPECTED_RELATIONSHIPS.length}`
  );
  for (const expectedRel of EXPECTED_RELATIONSHIPS) {
    const hit = found.some((r) => r.from === expectedRel.from && r.to === expectedRel.to);
    assertCheck(
      `relationship:${expectedRel.from}->${expectedRel.to}`,
      hit,
      hit ? "present" : "not found in relationships.tmdl"
    );
  }
  const disconnected = ["StatementLines", "BalanceLines", "CashFlowLines"];
  for (const table of disconnected) {
    const mentioned = found.some((r) => r.from.startsWith(`${table}.`) || r.to.startsWith(`${table}.`));
    assertCheck(`relationship:${table}-disconnected`, !mentioned, mentioned ? "unexpectedly related" : "confirmed disconnected");
  }
}

// ---------------------------------------------------------------------------
// 4. Page/visual metadata bindings against capabilities.json + report-layout.json
// ---------------------------------------------------------------------------
const capabilities = readJson(path.join(REPO_ROOT, "capabilities.json"));
const capabilityRoleNames = new Set(capabilities.dataRoles.map((r) => r.name));
assertCheck(
  "capabilities-roles-known",
  ["Lines", "Period", "Actual", "Budget", "Prior"].every((r) => capabilityRoleNames.has(r)),
  `capabilities.json dataRoles: ${[...capabilityRoleNames].join(", ")}`
);

const layout = readJson(path.join(SAMPLES, "report-layout.json"));
assertCheck(
  "layout-visual-identity",
  layout.visualGuid === RESOURCE_GUID && layout.visualVersion === RESOURCE_VERSION,
  `report-layout.json visualGuid/visualVersion: ${layout.visualGuid} / ${layout.visualVersion}`
);

// Maps each report-layout.json page entry to the PBIR page folder name used on disk.
const PAGE_FOLDERS = { "P&L": "ProfitAndLoss", "Balance sheet": "BalanceSheet", "Cash flow": "CashFlow" };
const HOME_TABLE_BY_MEASURE_FIELD = {
  "[Actual]": { table: "Facts", property: "Actual" },
  "[Budget]": { table: "Facts", property: "Budget" },
  "[Prior]": { table: "Facts", property: "Prior" },
  "[BS Actual]": { table: "BalanceFact", property: "BS Actual" },
  "[BS Budget]": { table: "BalanceFact", property: "BS Budget" },
  "[BS Prior]": { table: "BalanceFact", property: "BS Prior" },
  "[CF Actual]": { table: "CashFlowFact", property: "CF Actual" },
  "[CF Budget]": { table: "CashFlowFact", property: "CF Budget" },
  "[CF Prior]": { table: "CashFlowFact", property: "CF Prior" },
};

function firstProjection(visual, role) {
  return visual?.visual?.query?.queryState?.[role]?.projections?.[0];
}
function columnRef(projection) {
  const c = projection?.field?.Column;
  return c ? `${c.Expression.SourceRef.Entity}.${c.Property}` : undefined;
}
function measureRef(projection) {
  const m = projection?.field?.Measure;
  return m ? `${m.Expression.SourceRef.Entity}.${m.Property}` : undefined;
}

for (const pageSpec of layout.pages) {
  const folder = PAGE_FOLDERS[pageSpec.name];
  if (!folder) {
    warn(`page:${pageSpec.name}`, "no known PBIR folder mapping; skipped (unexpected new page name in report-layout.json)");
    continue;
  }
  const pageDir = path.join(REPORT_DIR, "definition", "pages", folder);
  const pageJsonPath = path.join(pageDir, "page.json");
  if (!existsSync(pageJsonPath)) {
    fail(`page:${folder}`, "missing page.json");
    continue;
  }
  const pageJson = readJson(pageJsonPath);
  assertCheck(`page:${folder}:size`, pageJson.width === layout.pageDefaults.width && pageJson.height === layout.pageDefaults.height, JSON.stringify({ width: pageJson.width, height: pageJson.height }));

  const titleVisualPath = path.join(pageDir, "visuals", "Title", "visual.json");
  const usageTipsVisualPath = path.join(pageDir, "visuals", "UsageTips", "visual.json");
  const sliceVisualPath = path.join(pageDir, "visuals", "PeriodSlicer", "visual.json");
  const matrixVisualPath = path.join(pageDir, "visuals", "StatementMatrix", "visual.json");
  for (const [label, p] of [
    ["Title", titleVisualPath],
    ["UsageTips", usageTipsVisualPath],
    ["PeriodSlicer", sliceVisualPath],
    ["StatementMatrix", matrixVisualPath],
  ]) {
    assertCheck(`page:${folder}:${label}-exists`, existsSync(p), p);
  }
  if (!existsSync(titleVisualPath) || !existsSync(usageTipsVisualPath) || !existsSync(sliceVisualPath) || !existsSync(matrixVisualPath)) continue;

  const titleVisual = readJson(titleVisualPath);
  const runValue = titleVisual.visual?.objects?.general?.[0]?.properties?.paragraphs?.[0]?.textRuns?.[0]?.value;
  assertCheck(`page:${folder}:title-text`, runValue === pageSpec.title, `expected ${JSON.stringify(pageSpec.title)}, got ${JSON.stringify(runValue)}`);
  assertCheck(
    `page:${folder}:title-position`,
    JSON.stringify({ x: titleVisual.position.x, y: titleVisual.position.y, width: titleVisual.position.width, height: titleVisual.position.height }) ===
      JSON.stringify(layout.pageDefaults.title),
    JSON.stringify(titleVisual.position)
  );

  const usageTipsVisual = readJson(usageTipsVisualPath);
  const usageTipsValue = usageTipsVisual.visual?.objects?.general?.[0]?.properties?.paragraphs?.[0]?.textRuns?.[0]?.value;
  assertCheck(`page:${folder}:usage-tips-text`, usageTipsValue === pageSpec.usageTips, `expected ${JSON.stringify(pageSpec.usageTips)}, got ${JSON.stringify(usageTipsValue)}`);
  assertCheck(
    `page:${folder}:usage-tips-position`,
    usageTipsVisual.position.x === layout.pageDefaults.usageTips.x &&
      usageTipsVisual.position.y === layout.pageDefaults.usageTips.y &&
      usageTipsVisual.position.width === layout.pageDefaults.usageTips.width &&
      usageTipsVisual.position.height === layout.pageDefaults.usageTips.height,
    JSON.stringify(usageTipsVisual.position)
  );

  const sliceVisual = readJson(sliceVisualPath);
  const sliceProjection = firstProjection(sliceVisual, "Values");
  assertCheck(
    `page:${folder}:slicer-field`,
    columnRef(sliceProjection) === "Period.Period",
    `expected Period.Period, got ${columnRef(sliceProjection)}`
  );
  assertCheck(
    `page:${folder}:slicer-position`,
    sliceVisual.position.x === layout.pageDefaults.periodSlicer.x &&
      sliceVisual.position.y === layout.pageDefaults.periodSlicer.y &&
      sliceVisual.position.width === layout.pageDefaults.periodSlicer.width &&
      sliceVisual.position.height === layout.pageDefaults.periodSlicer.height,
    JSON.stringify(sliceVisual.position)
  );

  const matrixVisual = readJson(matrixVisualPath);
  assertCheck(`page:${folder}:visualType`, matrixVisual.visual.visualType === RESOURCE_GUID, matrixVisual.visual.visualType);
  assertCheck(
    `page:${folder}:matrix-position`,
    matrixVisual.position.x === layout.pageDefaults.matrix.x &&
      matrixVisual.position.y === layout.pageDefaults.matrix.y &&
      matrixVisual.position.width === layout.pageDefaults.matrix.width &&
      matrixVisual.position.height === layout.pageDefaults.matrix.height,
    JSON.stringify(matrixVisual.position)
  );

  const queryState = matrixVisual.visual.query.queryState;
  assertCheck(
    `page:${folder}:queryState-roles`,
    JSON.stringify(Object.keys(queryState).sort()) === JSON.stringify(["Actual", "Budget", "Lines", "Period", "Prior"]),
    Object.keys(queryState).join(", ")
  );

  const expectedLineFields = pageSpec.roles.Lines.map((f) => f.replace("[", ".").replace("]", ""));
  const actualLineFields = queryState.Lines.projections.map(columnRef);
  assertCheck(
    `page:${folder}:lines-hierarchy`,
    JSON.stringify(actualLineFields) === JSON.stringify(expectedLineFields),
    `expected ${expectedLineFields.join(" > ")}, got ${actualLineFields.join(" > ")}`
  );
  assertCheck(`page:${folder}:lines-active`, queryState.Lines.projections.every(projection => projection.active === true), "Bound line hierarchy fields are active");

  assertCheck(
    `page:${folder}:period-field`,
    columnRef(firstProjection(matrixVisual, "Period")) === "Period.Period",
    columnRef(firstProjection(matrixVisual, "Period"))
  );

  for (const role of ["Actual", "Budget", "Prior"]) {
    const expectedField = pageSpec.roles[role][0];
    const expectedRef = HOME_TABLE_BY_MEASURE_FIELD[expectedField];
    const actualRef = measureRef(firstProjection(matrixVisual, role));
    assertCheck(
      `page:${folder}:${role}-measure`,
      actualRef === `${expectedRef.table}.${expectedRef.property}`,
      `expected ${expectedRef.table}.${expectedRef.property}, got ${actualRef}`
    );
  }

  const statementProps = matrixVisual.visual.objects?.statement?.[0]?.properties;
  assertCheck(`page:${folder}:statement-variances`, statementProps?.variances?.expr?.Literal?.Value === String(layout.pageDefaults.statement.variances), statementProps?.variances);
  assertCheck(`page:${folder}:statement-direction`, statementProps?.direction?.expr?.Literal?.Value === String(layout.pageDefaults.statement.direction), statementProps?.direction);

  const lineMetadataFile = path.join(SAMPLES, pageSpec.lineMetadataSource);
  const canonicalLinesText = existsSync(lineMetadataFile) ? readText(lineMetadataFile).replace(/\n+$/, "") : undefined;
  const literal = statementProps?.lines?.expr?.Literal?.Value;
  const validLiteral = typeof literal === "string" && /^'(?:[^']|'')*'$/.test(literal);
  assertCheck(`page:${folder}:quoted-text-literal`, validLiteral, "PBIR text constants require single-quoted SQ literal syntax");
  const embeddedLinesText = validLiteral ? literal.slice(1, -1).replaceAll("''", "'") : undefined;
  assertCheck(
    `page:${folder}:lines-metadata-verbatim`,
    canonicalLinesText !== undefined && embeddedLinesText === canonicalLinesText,
    canonicalLinesText === undefined ? `missing canonical file ${lineMetadataFile}` : "embedded JSON text matches canonical file exactly"
  );
  // The embedded literal must also itself be valid JSON conforming to what capabilities.json
  // declares as a plain text setting (no schema exists for the array's own shape here, so this
  // is a structural sanity parse, not a schema check).
  try {
    const parsedLines = JSON.parse(embeddedLinesText ?? "");
    assertCheck(`page:${folder}:lines-metadata-parses`, Array.isArray(parsedLines) && parsedLines.length > 0, `${parsedLines.length} entries`);
  } catch (err) {
    fail(`page:${folder}:lines-metadata-parses`, err.message);
  }
}

// pages.json / pbir / pbism / report.json cross-checks
const pagesJson = readJson(path.join(REPORT_DIR, "definition", "pages", "pages.json"));
assertCheck(
  "pages-order",
  JSON.stringify(pagesJson.pageOrder) === JSON.stringify(["ProfitAndLoss", "BalanceSheet", "CashFlow", "ModelChecks"]),
  JSON.stringify(pagesJson.pageOrder)
);
assertCheck("pages-active", pagesJson.activePageName === "ProfitAndLoss", pagesJson.activePageName);

const reportJson = readJson(path.join(REPORT_DIR, "definition", "report.json"));
const resourceItem = reportJson.resourcePackages?.[0]?.items?.[0];
assertCheck(
  "report-resourcePackage",
  reportJson.resourcePackages?.[0]?.type === "CustomVisual" &&
    resourceItem?.type === "CustomVisualMetadata" &&
    reportJson.resourcePackages?.[0]?.name === RESOURCE_GUID &&
    resourceItem?.name === `${RESOURCE_GUID}.pbiviz.json` &&
    resourceItem?.path === `${RESOURCE_GUID}.pbiviz.json`,
  JSON.stringify(reportJson.resourcePackages)
);

const pbir = readJson(path.join(REPORT_DIR, "definition.pbir"));
assertCheck(
  "pbir-byPath",
  pbir.datasetReference?.byPath?.path === "../AtlynFinancialMatrix.SemanticModel",
  pbir.datasetReference?.byPath?.path
);

// ---------------------------------------------------------------------------
// 5. Embedded resource identity: GUID/version/SHA-256 against the real dist artifact
// ---------------------------------------------------------------------------
const buildSummaryPath = path.join(REPO_ROOT, "dist", "sample-report-build.json");
if (!existsSync(buildSummaryPath)) {
  fail(
    "resource-embedding",
    "dist/sample-report-build.json not found; run `node scripts/build-sample.mjs` (after `npm run build`/`npm run package`) to embed and check the real .pbiviz. Source/schema validation above does not depend on this."
  );
} else {
  const summary = readJson(buildSummaryPath);
  const generatedStructureIssues = sampleStructureIssues(summary.outDir);
  assertCheck("generated-required-files", generatedStructureIssues.length === 0, generatedStructureIssues.join("; ") || "Generated project has all required entry files");
  const artifact = await readArtifact();
  assertCheck("resource-current-artifact", summary.embeddedResource?.sha256 === artifact.sha256, "Build record matches the current official package");
  assertCheck(
    "resource-pbir-manifest",
    readFileSync(summary.embeddedResource.manifestPath).equals(artifact.manifestBytes),
    "Byte-exact official manifest in CustomVisuals"
  );
  assertCheck(
    "resource-pbir-metadata",
    readFileSync(summary.embeddedResource.resourcePath).equals(artifact.resourceBytes),
    "Byte-exact official metadata/JS/CSS/notices in CustomVisuals"
  );
  for (const sourceFile of walk(PBIP)) {
    if (sourceFile.startsWith(SCHEMA_DIR) || path.basename(sourceFile) === "README.md") continue;
    const generatedFile = path.join(summary.outDir, path.relative(PBIP, sourceFile));
    assertCheck(`generated:${path.relative(PBIP, sourceFile)}`, existsSync(generatedFile) && readFileSync(sourceFile).equals(readFileSync(generatedFile)), "Generated project matches authored source");
  }
  assertCheck(
    "resource-identity",
    summary.embeddedResource?.guid === RESOURCE_GUID && summary.embeddedResource?.version === RESOURCE_VERSION,
    JSON.stringify(summary.embeddedResource)
  );
  const embeddedPath = summary.embeddedResource?.embeddedPath;
  if (embeddedPath && existsSync(embeddedPath)) {
    const bytes = readFileSync(embeddedPath);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    assertCheck(
      "resource-sha256-matches-build-record",
      sha256 === summary.embeddedResource.sha256,
      `${sha256} vs recorded ${summary.embeddedResource.sha256}`
    );
    assertCheck("resource-size-matches-build-record", bytes.length === summary.embeddedResource.bytes, `${bytes.length} vs ${summary.embeddedResource.bytes}`);
    if (existsSync(summary.embeddedResource.sourceArtifact)) {
      const sourceBytes = readFileSync(summary.embeddedResource.sourceArtifact);
      const sourceSha256 = createHash("sha256").update(sourceBytes).digest("hex");
      assertCheck(
        "resource-sha256-matches-dist-artifact",
        sourceSha256 === sha256,
        sourceSha256 === sha256 ? "embedded pbiviz is byte-identical to dist artifact" : "MISMATCH: embedded resource diverged from dist artifact"
      );
    } else {
      fail("resource-sha256-matches-dist-artifact", `original dist artifact ${summary.embeddedResource.sourceArtifact} no longer present to re-check`);
    }

    const nativeMatrix = readJson(path.join(REPORT_DIR, "definition", "pages", "ModelChecks", "visuals", "ModelCheckMatrix", "visual.json"));
    assertCheck("native-matrix-type", nativeMatrix.visual.visualType === "pivotTable", "Native matrix visualType is pivotTable");
    assertCheck("native-matrix-roles", ["Rows", "Columns", "Values"].every(role => nativeMatrix.visual.query.queryState[role]?.projections?.length), "Native matrix roles are bound");
  } else {
    fail("resource-embedded-file-present", `${embeddedPath} missing`);
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
const passCount = results.filter((r) => r.status === "PASS").length;
const failCount = results.filter((r) => r.status === "FAIL").length;
const warnCount = results.filter((r) => r.status === "WARN").length;

console.log(`\n${"=".repeat(72)}`);
console.log("PBIP sample validation results");
console.log("=".repeat(72));
for (const r of results) {
  if (r.status === "PASS") continue; // keep passing-noise low; failures/warnings matter most
  console.log(`[${r.status}] ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
}
console.log("-".repeat(72));
console.log(`${passCount} passed, ${warnCount} warnings, ${failCount} failed (of ${results.length} checks)`);
console.log(
  "\nScope reminder: this validates local sources/schemas/bindings/hashes only. It does NOT\n" +
    "open Power BI Desktop, refresh Power Query/DAX, render the report, or save a .pbix.\n" +
    "Native Desktop/service verification remains pending a human with Desktop access."
);

writeFileSync(path.join(REPO_ROOT, "dist", "sample-validation.json"), JSON.stringify({
  validatedAt: new Date().toISOString(), passCount, warnCount, failCount, results,
  scope: "Offline schema, source, bindings and embedded package checks; no Desktop/M/DAX execution."
}, null, 2) + "\n");
process.exit(failCount > 0 || warnCount > 0 ? 1 : 0);
