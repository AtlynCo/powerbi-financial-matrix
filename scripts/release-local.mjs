import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const git = (...args) => {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || "Git inspection failed");
  return result.stdout.trim();
};
const sourceCommit = git("rev-parse", "HEAD");
const sourceDirty = git("status", "--porcelain").length > 0;
const commands = ["eslint", "verify", "audit:tooling", "sample:build", "sample:validate", "test:evidence", "evidence:validate"];
const folder = join("dist", "local-gates");
mkdirSync(folder, { recursive: true });
const report = { startedAt: new Date().toISOString(), sourceCommit, sourceDirty, node: process.version, commands: [] };
if (!process.env.npm_execpath) throw new Error("Run through npm run release:local so the local npm CLI is identified.");
for (const command of commands) {
  console.log(`Local release gate: npm run ${command}`);
  const startedAt = new Date().toISOString();
  const result = spawnSync(process.execPath, [process.env.npm_execpath, "run", command], {
    encoding: "utf8", maxBuffer: 32 * 1024 * 1024, env: process.env
  });
  const output = (result.stdout ?? "") + (result.stderr ?? "");
  const log = command.replaceAll(":", "-") + ".log";
  writeFileSync(join(folder, log), output);
  process.stdout.write(output);
  report.commands.push({ command: `npm run ${command}`, startedAt, completedAt: new Date().toISOString(), exitCode: result.status, log });
  report.sourceUnchanged = git("rev-parse", "HEAD") === sourceCommit && git("status", "--porcelain").length === 0;
  report.completedAt = new Date().toISOString();
  writeFileSync(join(folder, "results.json"), JSON.stringify(report, null, 2) + "\n");
  if (result.status !== 0) throw new Error(`Local gate ${command} failed; preserved ${join(folder, log)}`);
}
console.log("Local gates completed. Native Desktop/service/PBIX, legal approval and live submission remain separate.");
