import { mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const home = resolve(".tmp", "tool-home");
const certificateFolder = join(home, "pbiviz-certs");
mkdirSync(certificateFolder, { recursive: true });
const env = { ...process.env, HOME: home, USERPROFILE: home };
const run = (command, args) => {
  const result = spawnSync(command, args, { env, stdio: "inherit", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed with exit ${result.status}`);
};
const secretNames = ["PowerBICustomVisualTest_public.pfx", "PowerBICustomVisualTestPass.txt", "PowerBICustomVisualTest_public.crt", "PowerBICustomVisualTest_private.key"];
try {
  // pbiviz resolves a development certificate even when packaging. Never install one in a user store.
  if (process.platform === "win32") {
    run("pwsh", ["-NoProfile", "-NonInteractive", "-File", resolve("scripts", "certificate.ps1"), "-Directory", certificateFolder]);
  } else {
    run("openssl", ["req", "-newkey", "rsa:2048", "-nodes", "-x509", "-days", "7", "-subj", "/CN=localhost",
      "-keyout", join(certificateFolder, secretNames[3]), "-out", join(certificateFolder, secretNames[2])]);
  }
  const start = Date.now();
  run(process.execPath, [resolve("node_modules", "powerbi-visuals-tools", "bin", "pbiviz.js"), "package", "--all-locales", "--no-stats", "--certification-audit"]);
  const { visual } = JSON.parse(readFileSync("pbiviz.json", "utf8"));
  const output = resolve("dist", `${visual.guid}.${visual.version}.pbiviz`);
  if (statSync(output).mtimeMs < start - 1000) throw new Error("Packaging did not produce a fresh artifact.");
} finally {
  for (const name of secretNames) rmSync(join(certificateFolder, name), { force: true });
}
