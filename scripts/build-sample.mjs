import assert from "node:assert/strict";
import { mkdirSync, rmSync, cpSync, copyFileSync, writeFileSync } from "node:fs";
import { join, dirname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readArtifact } from "./artifact.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "samples", "pbip");
const output = join(root, "dist", "sample-report");
const artifact = await readArtifact();
const guid = "AtlynFinancialMatrixCA42B8646E934AF1B6252CB8E39C0D71";
assert.equal(artifact.resource.visual.guid, guid);
assert.equal(artifact.resource.visual.version, "1.0.0.0");

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
cpSync(source, output, {
  recursive: true,
  filter: path => !path.startsWith(join(source, "schema")) && basename(path) !== "README.md"
});

// PBIR loads private visuals from CustomVisuals/<GUID>, not a ZIP masquerading as metadata.
// Copy the two official ZIP entries without changing/repackaging the PBIVIZ itself.
const customVisual = join(output, "AtlynFinancialMatrix.Report", "CustomVisuals", guid);
mkdirSync(join(customVisual, "resources"), { recursive: true });
writeFileSync(join(customVisual, "package.json"), artifact.manifestText);
const resourcePath = join(customVisual, "resources", `${guid}.pbiviz.json`);
writeFileSync(resourcePath, artifact.resourceText);

const packageFolder = join(output, "VisualPackage");
mkdirSync(packageFolder, { recursive: true });
const embeddedPath = join(packageFolder, basename(artifact.path));
copyFileSync(artifact.path, embeddedPath);
const summary = {
  builtAt: new Date().toISOString(), sourceDir: source, outDir: output,
  embeddedResource: {
    guid, version: artifact.resource.visual.version, sourceArtifact: artifact.path,
    embeddedPath, resourcePath, manifestPath: join(customVisual, "package.json"),
    sha256: artifact.sha256, bytes: artifact.size
  },
  note: "Official package preserved byte-for-byte; unmodified metadata entries wired through PBIR CustomVisuals. Native Desktop refresh/PBIX remains pending."
};
writeFileSync(join(root, "dist", "sample-report-build.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
