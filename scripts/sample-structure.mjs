import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const report = "AtlynFinancialMatrix.Report";
const model = "AtlynFinancialMatrix.SemanticModel";
const versionSchema = "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/versionMetadata/1.0.0/schema.json";

export function sampleStructureIssues(root) {
  const issues = [];
  const required = [
    "AtlynFinancialMatrix.pbip",
    join(report, "definition.pbir"),
    join(report, "definition", "version.json"),
    join(report, "definition", "report.json"),
    join(report, "definition", "pages", "pages.json"),
    join(model, "definition.pbism"),
    join(model, "definition", "database.tmdl"),
    join(model, "definition", "model.tmdl"),
    join(model, "definition", "relationships.tmdl")
  ];
  const isFile = path => existsSync(path) && statSync(path).isFile();
  for (const relative of required) {
    if (!isFile(join(root, relative))) issues.push(`Missing required sample file: ${relative}`);
  }
  const versionPath = join(root, report, "definition", "version.json");
  if (isFile(versionPath)) {
    const version = JSON.parse(readFileSync(versionPath, "utf8"));
    if (version?.$schema !== versionSchema || version.version !== "2.0.0") {
      issues.push("PBIR definition/version.json must declare versionMetadata/1.0.0 and report definition version 2.0.0.");
    }
  }
  const pbirPath = join(root, report, "definition.pbir");
  if (isFile(pbirPath)) {
    const pbir = JSON.parse(readFileSync(pbirPath, "utf8"));
    if (pbir?.version !== "4.0") issues.push("The enhanced PBIR sample requires definition.pbir version 4.0.");
  }
  const pagesPath = join(root, report, "definition", "pages", "pages.json");
  if (isFile(pagesPath)) {
    const pages = JSON.parse(readFileSync(pagesPath, "utf8"));
    if (!Array.isArray(pages?.pageOrder) || !pages.pageOrder.length) {
      issues.push("PBIR pages.json must list the sample pages.");
    } else {
      for (const page of pages.pageOrder) {
        if (typeof page !== "string" || !/^[A-Za-z0-9_-]+$/.test(page) ||
            !isFile(join(root, report, "definition", "pages", page, "page.json"))) {
          issues.push(`Missing or invalid listed PBIR page: ${String(page)}`);
        }
      }
    }
  }
  return issues;
}
