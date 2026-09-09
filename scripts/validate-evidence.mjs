import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readArtifact } from "./artifact.mjs";

const artifact = await readArtifact();
const json = path => JSON.parse(readFileSync(path, "utf8"));
const capture = json("dist/submission-assets/capture-provenance.json");
const performance = json("dist/quality/performance.json");
assert.equal(capture.packageSha256, artifact.sha256, "Listing screenshots belong to a different package");
assert.equal(performance.packageSha256, artifact.sha256, "Performance evidence belongs to a different package");
assert.deepEqual(capture.runtimeRequests, []);
assert.ok(capture.files.length >= 1 && capture.files.length <= 5);
const dimensions = (path, width, height) => {
  const png = readFileSync(path);
  assert.ok(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `${path}: not PNG`);
  assert.equal(png.readUInt32BE(16), width, `${path}: width`);
  assert.equal(png.readUInt32BE(20), height, `${path}: height`);
};
dimensions("assets/icon.png", 20, 20);
dimensions("assets/logo.png", 300, 300);
for (const name of capture.files) {
  assert.match(name, /^screenshot-(pnl|balance|cashflow)\.png$/);
  dimensions(join("dist", "submission-assets", name), 1366, 768);
  assert.ok(readFileSync(join("dist", "submission-assets", name)).length <= 1024 * 1024, `${name}: exceeds 1024KB`);
}
assert.equal(performance.sampleCount, 30);
assert.equal(performance.warmups, 3);
assert.equal(performance.results.length, 5);
for (const result of performance.results) {
  assert.ok(result.rows * result.columns <= 24000);
  for (const metric of ["renderToFramesMs", "synchronousRenderMs", "scrollToFramesMs", "selectionToFramesMs"]) {
    const measurements = result[metric];
    const ordered = [...measurements.samples].sort((a, b) => a - b);
    assert.equal(ordered.length, performance.sampleCount);
    assert.ok(ordered.every(value => Number.isFinite(value) && value >= 0));
    assert.equal(measurements.p50, ordered[Math.ceil(ordered.length * 0.5) - 1]);
    assert.equal(measurements.p95, ordered[Math.ceil(ordered.length * 0.95) - 1]);
    assert.equal(measurements.max, ordered.at(-1));
  }
}
for (const filename of ["test-results/browser-results.json", "dist/evidence-runner-results.json"]) {
  const report = json(filename);
  assert.equal(report.stats.unexpected, 0, `${filename}: failures`);
  assert.equal(report.stats.flaky, 0, `${filename}: flaky results`);
  assert.equal(report.stats.skipped, 0, `${filename}: skipped results`);
  assert.equal(report.stats.expected, filename.includes("browser-results") ? 22 : 2, `${filename}: full required suite was not executed`);
}
const report = {
  validatedAt: new Date().toISOString(), packageSha256: artifact.sha256,
  icon: "20x20 PNG", logo: "300x300 PNG", screenshots: capture.files.map(name => ({ name, dimensions: "1366x768 PNG" })),
  performanceWorkloads: performance.results.map(({ name, rows, columns }) => ({ name, rows, columns })),
  nativeHostAcceptance: "PENDING; this validator does not open Desktop, produce PBIX or establish Marketplace acceptance."
};
writeFileSync("dist/evidence-validation.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
