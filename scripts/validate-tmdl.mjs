import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const env = {
  ...process.env,
  DOTNET_CLI_HOME: resolve(".tmp", "dotnet-home"),
  NUGET_PACKAGES: resolve(".tmp", "nuget-packages"),
  NUGET_HTTP_CACHE_PATH: resolve(".tmp", "nuget-http-cache"),
  NUGET_SCRATCH: resolve(".tmp", "nuget-scratch"),
  DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_SKIP_FIRST_TIME_EXPERIENCE: "1", DOTNET_NOLOGO: "1",
  DOTNET_GENERATE_ASPNET_CERTIFICATE: "false", DOTNET_CLI_USE_MSBUILD_SERVER: "0",
  MSBUILDDISABLENODEREUSE: "1"
};
const project = resolve("scripts", "tmdl", "ValidateTmdl.csproj");
const model = resolve(process.argv[2] ?? "samples/pbip/AtlynFinancialMatrix.SemanticModel/definition");
const run = args => {
  const result = spawnSync("dotnet", args, { encoding: "utf8", env, maxBuffer: 8 * 1024 * 1024 });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.error || result.status !== 0) throw new Error(result.error?.message ?? "Official TMDL parser command failed.");
  return result.stdout;
};
const sdk = run(["--version"]).trim();
run(["restore", project, "--locked-mode", "--verbosity", "quiet"]);
const output = run(["run", "--project", project, "--configuration", "Release", "--no-restore", "--", model]);
const result = JSON.parse(output.trim().split(/\r?\n/).at(-1));
mkdirSync("dist", { recursive: true });
writeFileSync("dist/tmdl-validation.json", JSON.stringify({ validatedAt: new Date().toISOString(), model, dotnetSdk: sdk, ...result }, null, 2) + "\n");
