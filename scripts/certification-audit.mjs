import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readArtifact } from "./artifact.mjs";

const { resource } = await readArtifact();
const files = readdirSync("src").filter(name => name.endsWith(".ts")).map(name => join("src", name));
const source = files.map(file => readFileSync(file, "utf8")).join("\n");
const prohibited = [
  [/\b(?:eval|fetch|importScripts)\s*\(/, "dynamic evaluation/network"],
  [/\bnew\s+(?:Function|XMLHttpRequest|WebSocket|Worker)\s*\(/, "dynamic code/network/worker"],
  [/\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b/, "HTML injection"],
  [/\b(?:localStorage|sessionStorage|telemetry|authenticationService|licenseManager|launchUrl)\b/, "storage/telemetry/auth/licensing"]
];
for (const [pattern, label] of prohibited) {
  assert.ok(!pattern.test(source), `Source audit found ${label}`);
}
for (const [pattern, label] of prohibited.slice(0, 2)) assert.ok(!pattern.test(resource.content.js), `Bundle audit found ${label}`);
assert.ok(!/@import|url\s*\(/i.test(resource.content.css), "CSS must not load external resources");
assert.deepEqual(resource.capabilities.privileges, []);
assert.deepEqual(resource.externalJS, []);
assert.ok(source.includes("renderingStarted") && source.includes("renderingFinished") && source.includes("renderingFailed"));
assert.ok(source.includes("getFormattingModel") && source.includes("withMatrixNode"));
const notices = readFileSync("THIRD-PARTY-NOTICES.txt", "utf8");
assert.ok(notices.includes("powerbi-visuals-utils-formattingutils") && notices.includes("MIT License"));
console.log("Local source/bundle certification-oriented audit passed. This is not Microsoft certification or a security review.");
