import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import JSZip from "jszip";

export async function readArtifact() {
  const files = readdirSync("dist").filter(name => name.endsWith(".pbiviz"));
  if (files.length !== 1) throw new Error(`Expected exactly one release pbiviz in dist, found ${files.length}.`);
  const path = resolve("dist", files[0]);
  const bytes = readFileSync(path);
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
  const manifestBytes = await zip.file("package.json").async("nodebuffer");
  const manifestText = manifestBytes.toString("utf8");
  const manifest = JSON.parse(manifestText);
  const resourcePath = `resources/${manifest.visual.guid}.pbiviz.json`;
  const resourceBytes = await zip.file(resourcePath).async("nodebuffer");
  const resourceText = resourceBytes.toString("utf8");
  const resource = JSON.parse(resourceText);
  return {
    path, sha256: createHash("sha256").update(bytes).digest("hex"), size: bytes.length,
    manifest, resource, manifestBytes, resourceBytes, manifestText, resourceText
  };
}
