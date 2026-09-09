import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import JSZip from "jszip";
import { readArtifact } from "./artifact.mjs";

const git = (...args) => {
  const result = spawnSync("git", args, { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const readJson = path => JSON.parse(readFileSync(path, "utf8"));
const artifact = await readArtifact();
const commit = git("rev-parse", "HEAD");
assert.equal(git("status", "--porcelain"), "", "Commit the exact final source before creating an immutable dossier.");
const gates = readJson("dist/local-gates/results.json");
assert.equal(gates.sourceCommit, commit);
assert.equal(gates.sourceDirty, false, "Final local gates must start from clean committed source.");
assert.equal(gates.sourceUnchanged, true, "Source changed during final local gates.");
assert.equal(gates.commands.length, 7);
assert.ok(gates.commands.every(command => command.exitCode === 0));
assert.equal(readJson("dist/evidence-validation.json").packageSha256, artifact.sha256);
assert.equal(readJson("dist/artifact-validation.json").sha256, artifact.sha256);

const projectRoot = resolve(process.argv[2] ?? "dist/sample-report");
const projectRelative = relative(resolve("dist"), projectRoot);
assert.ok(projectRelative && !projectRelative.startsWith("..") && !isAbsolute(projectRelative), "Pass the generated PBIP directory under this worktree's dist.");
const walk = root => readdirSync(root, { withFileTypes: true }).flatMap(entry => {
  assert.ok(!entry.isSymbolicLink(), `Do not archive a symlink: ${join(root, entry.name)}`);
  assert.ok(!["node_modules", ".tmp", ".pbi"].includes(entry.name), `Unexpected local cache in delivery: ${entry.name}`);
  const path = join(root, entry.name);
  return entry.isDirectory() ? walk(path) : [path];
});
assert.ok(existsSync(projectRoot), `Missing generated PBIP directory: ${projectRoot}`);
const projectFiles = walk(projectRoot);
assert.equal(projectFiles.filter(path => path.endsWith(".pbip")).length, 1, "Expected exactly one bound offline report project.");
const sample = readJson("dist/sample-report-build.json");
assert.equal(resolve(sample.outDir), projectRoot, "Dossier project differs from the validated generated project.");
assert.equal(hash(readFileSync(sample.embeddedResource.embeddedPath)), artifact.sha256, "Project package is not the exact final PBIVIZ.");
assert.equal(readJson("dist/sample-validation.json").failCount, 0);
assert.equal(readJson("dist/sample-validation.json").warnCount, 0);
assert.equal(readJson("dist/tmdl-validation.json").tables, 8);
const output = resolve("dist", "dossier", `${commit.slice(0, 12)}-${artifact.sha256.slice(0, 12)}`);
assert.ok(!existsSync(output), `Immutable dossier already exists; do not overwrite ${output}`);
mkdirSync(output, { recursive: true });
const copy = (source, target) => {
  const path = join(output, target);
  mkdirSync(resolve(path, ".."), { recursive: true });
  copyFileSync(source, path);
};
copy(artifact.path, join("visual", basename(artifact.path)));
copy(`${artifact.path}.sha256`, join("visual", basename(artifact.path) + ".sha256"));
copy("THIRD-PARTY-NOTICES.txt", "THIRD-PARTY-NOTICES.txt");
for (const name of ["icon.png", "logo.png", "logo.svg"]) copy(join("assets", name), join("assets", name));
for (const path of walk("dist/submission-assets")) copy(path, join("assets", relative("dist/submission-assets", path)));
for (const path of walk("dist/local-gates")) copy(path, join("evidence", "local-gates", relative("dist/local-gates", path)));
for (const path of walk("dist/quality")) copy(path, join("evidence", "quality", relative("dist/quality", path)));
for (const path of ["dist/artifact-validation.json", "dist/evidence-validation.json", "dist/evidence-runner-results.json", "test-results/browser-results.json", "dist/sample-report-build.json", "dist/sample-validation.json", "dist/tmdl-validation.json"]) copy(path, join("evidence", basename(path)));
for (const name of ["SUBMISSION-DOSSIER.md", "RELEASE-QUALITY.md", "RELEASE-RESEARCH.md", "PUBLICATION-CHECKLIST.md", "PBIP-SAMPLE.md"]) copy(join("docs", name), join("docs", name));
const projectZip = new JSZip();
for (const path of projectFiles) {
  assert.ok(!/\.(?:pfx|pem|key|cer|abf)$/i.test(path), `Unexpected secret/cache file: ${path}`);
  projectZip.file(relative(projectRoot, path).split("\\").join("/"), readFileSync(path));
}
writeFileSync(join(output, "offline-bound-sample.zip"), await projectZip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
const sourceZip = join(output, `source-${commit}.zip`);
git("archive", "--format=zip", `--output=${sourceZip}`, commit);
const performance = readJson("dist/quality/performance.json");
const files = walk(output).map(path => ({
  path: relative(output, path).split("\\").join("/"), bytes: statSync(path).size, sha256: hash(readFileSync(path))
})).sort((a, b) => a.path.localeCompare(b.path));
const manifest = {
  createdAt: new Date().toISOString(), repository: "AtlynCo/powerbi-financial-matrix",
  sourceCommit: commit, sourceReviewBranch: git("branch", "--show-current"), certificationBranchRequired: "certification",
  visual: { guid: artifact.resource.visual.guid, version: artifact.resource.visual.version, filename: basename(artifact.path), sha256: artifact.sha256 },
  localGates: gates.commands.map(({ command, exitCode }) => ({ command, exitCode })),
  performance: {
    environment: performance.environment, sampleCount: performance.sampleCount, warmups: performance.warmups,
    results: performance.results.map(({ name, rows, columns, renderToFramesMs, scrollToFramesMs, selectionToFramesMs }) => ({
      name, rows, columns,
      renderMs: { p50: renderToFramesMs.p50, p95: renderToFramesMs.p95, max: renderToFramesMs.max },
      scrollMs: { p50: scrollToFramesMs.p50, p95: scrollToFramesMs.p95, max: scrollToFramesMs.max },
      selectionMs: { p50: selectionToFramesMs.p50, p95: selectionToFramesMs.p95, max: selectionToFramesMs.max }
    }))
  },
  submissionReady: false,
  remainingOwnerGates: [
    "Genuine offline PBIX via Desktop open/refresh/model acceptance; PBIP is not a substitute.",
    "Native Desktop/service/device, filtering, tooltip/context, bookmarks, accessibility and viewport export acceptance.",
    "Native acceptance of disclosed bounds for 20000-row policy input; official Microsoft sample report dataset.",
    "Original-code license, EULA/contract, privacy HTTPS URL, free-base/pricing policy and operational support approval.",
    "Exact certification ref/reviewer access, candidate listing screenshots approval/replacement, and live Partner Center submission by coordinator.",
    "PowerFin primary-source comparison remains unverified; no unsupported publisher/feature attribution."
  ],
  files
};
writeFileSync(join(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
const receipt = {
  directory: output, manifest: join(output, "manifest.json"), manifestSha256: hash(readFileSync(join(output, "manifest.json"))),
  sourceCommit: commit, package: join(output, "visual", basename(artifact.path)), packageSha256: artifact.sha256
};
writeFileSync("dist/dossier-receipt.json", JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify(receipt, null, 2));
