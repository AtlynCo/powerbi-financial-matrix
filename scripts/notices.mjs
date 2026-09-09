import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";

const root = JSON.parse(readFileSync("package.json", "utf8"));
const queue = Object.keys(root.dependencies);
const seen = new Set();
const sections = [
  "THIRD-PARTY NOTICES - Atlyn Financial Matrix 1.0.0.0",
  "Generated from installed, locked production dependencies. Full package sources are available through package-lock.json integrity-pinned npm references.",
  "These notices describe third-party licenses only. No project license, commercial terms, Microsoft certification or other legal approval is granted by this file."
];
while (queue.length) {
  const name = queue.shift();
  const require = createRequire(resolve("package.json"));
  const packagePath = require.resolve(`${name}/package.json`);
  const info = JSON.parse(readFileSync(packagePath, "utf8"));
  const key = `${info.name}@${info.version}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const folder = dirname(packagePath);
  const licenses = readdirSync(folder).filter(file => /^(license|copying)(\.|$)/i.test(file));
  if (!licenses.length) throw new Error(`Missing license text for ${key}`);
  sections.push(`\n${"=".repeat(72)}\n${key} - declared license: ${info.license}\n`);
  for (const license of licenses) sections.push(readFileSync(join(folder, license), "utf8"));
  if (info.name === "powerbi-visuals-utils-formattingutils") {
    for (const file of ["globalize.js", "globalize.cultures.js"]) {
      const source = readFileSync(join(folder, "lib", "globalize", file), "utf8");
      const notice = source.match(/^\/\*[\s\S]*?\*\//)?.[0];
      if (!notice?.includes("Software Freedom Conservancy")) throw new Error(`Missing embedded Globalize notice in ${file}`);
      sections.push(`\nEmbedded upstream component notice (${file}):\n${notice}\n`);
    }
  }
  queue.push(...Object.keys(info.dependencies ?? {}));
}
const text = sections.join("\n").trimEnd() + "\n";
writeFileSync("THIRD-PARTY-NOTICES.txt", text);
// Preserve notices inside the distributable itself, not only beside the source repository.
for (const locale of ["en-US", "fr-FR"]) {
  const path = join("stringResources", locale, "resources.resjson");
  const resources = JSON.parse(readFileSync(path, "utf8"));
  resources.ThirdParty_Notices = text;
  writeFileSync(path, JSON.stringify(resources, null, 2) + "\n");
}
console.log(`Generated full notices for ${seen.size} production dependencies.`);
