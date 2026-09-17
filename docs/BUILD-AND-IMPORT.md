# Build, package and import

## Prerequisites and boundaries

- Windows Power BI Desktop for assembling/importing the sample report.
- Node.js **22.12 or newer**, npm and a checkout of this private repository.
- .NET SDK **8 or newer** for the optional standalone PBIP check and required full release gate's official TMDL parser; pinned NuGet packages/lockfile and isolated caches are documented in [PBIP sample](PBIP-SAMPLE.md).
- For Windows builds: **PowerShell 7 (`pwsh`) on PATH**, using a currently supported release for the .NET cryptography APIs in the certificate helper. The non-Windows build path instead requires **OpenSSL on PATH**; Desktop report assembly still requires Windows.
- Network access for **initial dependency/browser acquisition only**, unless dependencies/browser binaries have been pre-provisioned through your approved process.
- Permission under your organization's Power BI tenant policy to import a private custom visual.

The visual itself and the synthetic sample query refresh do not require runtime network access. This does not mean that acquiring Desktop, npm packages, Chromium, signing certificates, or publishing to the Power BI service works offline.

Do not change the frozen identity casually:

```text
GUID:    AtlynFinancialMatrixCA42B8646E934AF1B6252CB8E39C0D71
Version: 1.0.1.0
```

The package uses the coordinator-confirmed shared Atlyn metadata: author **Atlyn**, email **atlyn.help@gmail.com**, and support URL **https://www.atlynco.com/docs/faq**. These are existing contact/FAQ details, not evidence that the mailbox is monitored, support is responsive, or this visual is approved for publication. The [publication checklist](PUBLICATION-CHECKLIST.md) retains those operational and legal gates.

## Reproduce the build

From the repository root in PowerShell:

```powershell
npm ci
npx playwright install chromium
npm run verify
```

Run these commands only in a trusted checkout; build scripts execute local code. The existing lockfile pins the dependency graph. `npm ci` must not be replaced by a speculative dependency upgrade when reproducing an artifact.

### Why all number-format cultures are packaged

The build wrapper invokes SDK packaging with **`--all-locales --no-stats`** (and the SDK's `--certification-audit` check). In tooling 7.2.1, the default locale-pruning loader is incompatible with formattingutils 7's ESM packaging. `--all-locales` bypasses that loader and keeps all bundled number-format cultures available **offline**; it does not add runtime culture downloads. Only **English and French UI resource strings** are supplied. Bundled numeric cultures do not imply UI translation into every language or host validation of every locale.

### Build-time certificate isolation

`npm run build` invokes **`node scripts/build.mjs`**, which wraps the official SDK **`pbiviz package --all-locales --no-stats --certification-audit`** operation. Use this wrapper rather than a bare SDK command.

The SDK resolves a development certificate even for packaging. The wrapper sets its child processes' **HOME and USERPROFILE to the current worktree's ignored `.tmp\tool-home`**, with certificate files under that isolated tool home. On Windows, `scripts\certificate.ps1` uses `pwsh` and .NET to generate a self-signed localhost certificate in memory, then exports the short-lived certificate/passphrase needed by the SDK. It does **not** install a certificate in a user/system certificate store or trust store. The non-Windows path uses OpenSSL to generate the local key/certificate.

The wrapper's `finally` block removes its named PFX, passphrase, certificate and private-key files after normal success or failure. A forcibly terminated process cannot be assumed to execute cleanup; inspect the isolated tool-home location after an interrupted build before sharing any workspace files. Do not reuse certificate secrets from another checkout, commit them, or install them into a trust store.

This is build-time compatibility handling, **not** a runtime certificate requirement, package signing assurance, trusted publisher identity or Microsoft certification.

### Dependency choices and advisory scope

| Dependency/setting | Choice and reason |
| --- | --- |
| `powerbi-visuals-tools` **7.2.1** | Official SDK packaging, with the locale-loader workaround above rather than a replacement package format. |
| `powerbi-visuals-api` **5.11.1** | Pinned Power BI host API package used by the implementation. |
| `powerbi-visuals-utils-formattingmodel` **7.1.0** | Modern format-pane controls. |
| `powerbi-visuals-utils-formattingutils` **7.0.0** | Host-compatible numeric formatting with offline culture data. |
| `tsx` **4.23.13** | Maintained TypeScript test runner update; development-only, not a visual runtime dependency. |
| `qs` override **6.16.0** | Advisory remediation for the current build/dev-server transitive query-string parser; currently in the development graph. |
| `sockjs`-scoped `uuid` override **11.1.1** | Targets the development server's SockJS dependency. Its use is the compatible CommonJS `require('uuid').v4()` API; unrelated UUID consumers are not globally overridden. |

These are deliberate, pinned build/test dependency changes, not permission to blanket-upgrade the graph. Re-run packaging, browser tests and both audits after changing them, and confirm that a development-only override has not gained a runtime consumer. The lockfile and generated dependency notices must track the actual graph. An attempted advisory fix is not a clean-audit result until the new audit completes.

### Commands

Useful existing commands:

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | TypeScript checks. |
| `npm run lint` | Existing ESLint rules for implementation/tests/scripts. |
| `npm run eslint` | Microsoft's documented full lint command with official Power BI recommended rules on runtime source. |
| `npm test` | Financial transformation/model unit tests. |
| `npm run test:samples` | Offline literal sample-source/arithmetic assertions; not M/DAX execution. |
| `npm run build` | SDK build; prebuild updates dependency notices. |
| `npm run package` | Build plus artifact validation. |
| `npm run artifact:validate` | Validate the built artifact; write its SHA-256 sidecar. |
| `npm run test:browser` | Packaged-artifact browser harness with a mocked Power BI host. |
| `npm run test:evidence` | Three 1366 x 768 packaged statement screenshots and five-workload raw performance distributions; no native-host claim. |
| `npm run evidence:validate` | Package-bound screenshot dimensions/size/provenance, full browser-suite outcomes and raw percentile arithmetic. |
| `npm run release:local` | Record all final local gates and logs from a clean source commit; does not submit or publish. |
| `npm run sample:build` | Assemble the fully bound offline project and exact official visual resources. |
| `npm run sample:validate` | Offline schemas/bindings/hashes plus Microsoft's actual TMDL deserializer; not M/DAX execution. |
| `npm run dossier` | Immutable source/package/PBIP/assets/evidence bundle and SHA-256 manifest from a clean validated commit. |
| `npm run audit:dependencies` | Production dependency advisory check; requires advisory-service access. |
| `npm run audit:tooling` | Broader tooling/development dependency advisory check. |
| `npm run audit:certification` | Certification-oriented static checks, **not certification**. |
| `npm run notices` | Regenerate dependency notices. |
| `npm run icons` | Regenerate the original 20px icon and 300px logo; requires the provisioned Chromium browser. |
| `npm run verify` | Typecheck, lint, unit/sample-source tests, package/validate, browser tests and production/static audits. |

Audit results are time-dependent; record the date and outputs. A nonzero audit/build exit needs investigation, not a claim that the release is ready. Browser assertions cannot establish that the same feature works with the real Desktop/service host.

The [release-quality evidence guide](RELEASE-QUALITY.md) explains the current local gates and their limits. The immutable submission manifest and preserved command logs identify a specific run. Production and full tooling audits are separate; neither is a permanent security guarantee.

## Local release gates only

All build, browser, package, sample and audit commands run locally. GitHub Actions and other GitHub-hosted CI/CD are not used or permitted for this release. GitHub is used only for authorized source delivery and review. No workflow, cloud coding session, Codespaces build or automatic publication step is required.

The offline sample check is available as `npm run test:samples` (or `node .\samples\check-sources.mjs`) and runs within `verify`. It validates literal sources and arithmetic, not the Power Query or DAX engines. Preserve the local package/hash and evidence in an approved durable artifact location, excluding the temporary tool-home, certificate and key material.

## Artifact and integrity

The SDK creates:

```text
dist\AtlynFinancialMatrixCA42B8646E934AF1B6252CB8E39C0D71.1.0.1.0.pbiviz
dist\AtlynFinancialMatrixCA42B8646E934AF1B6252CB8E39C0D71.1.0.1.0.pbiviz.sha256
```

`dist` is intentionally ignored. The `.pbiviz` is a real packaged visual, not a renamed JavaScript file. The sidecar is produced by artifact validation; verify it against the exact file distributed internally:

```powershell
Get-FileHash .\dist\AtlynFinancialMatrixCA42B8646E934AF1B6252CB8E39C0D71.1.0.1.0.pbiviz -Algorithm SHA256
Get-Content .\dist\AtlynFinancialMatrixCA42B8646E934AF1B6252CB8E39C0D71.1.0.1.0.pbiviz.sha256
```

Compare the digest values, not merely the filenames. Hashing establishes artifact identity, not Microsoft approval or legal permission to distribute. `assets\icon.png` is the original 20 × 20 visual icon. Full production dependency licenses and embedded Globalize copyright notices are preserved in the packaged `ThirdParty_Notices` localization resource; validation compares that text with `THIRD-PARTY-NOTICES.txt`. This avoids depending on a webpack license sidecar that the SDK archive may omit. Dependency notices are separate from the repository's original-code licensing decision.

The owner-approved model is existing Atlyn storefront subscriptions with an **ungated runtime and free shared viewing**, not paid-author enforcement. No activation, keys, licensing service or runtime requests are required. See [the current source-term statement](../README.md#storefront-acquisition-runtime-and-source-terms): the repository has no first-party license file or package license identifier, and this decision does not add one. Documentation-only clarification does not require rebuilding the current package or changing its version; retain the exact bytes and original source provenance.

## Import into Power BI Desktop

For the prepared sample, first follow [PBIP sample](PBIP-SAMPLE.md): generate and open `dist\sample-report\AtlynFinancialMatrix.pbip`. Tables, relationships, visuals and fields are already bound. Refresh/compare/save as PBIX in Desktop; do not substitute a renamed file. The manual steps below remain useful for adding the visual to another report or studying the canonical source recipe.

1. Open a new, local Desktop report. No sign-in is needed for constructing the offline sample itself.
2. In the **Visualizations** pane, select **… → Import a visual from a file** (in newer on-object UI, use the equivalent custom-visual import command).
3. Choose the built `.pbiviz` above. Review the host's custom-visual notice and your organizational policy.
4. Add **Atlyn Financial Matrix** to the canvas.
5. Follow [the sample assembly instructions](../samples/README.md) to create model tables/measures, relationships, bindings and metadata.
6. Save the resulting report locally under your own chosen filename. The repository deliberately does not ship a fabricated `.pbix` or claim a Desktop-validated report.

If Desktop blocks import, investigate tenant policy or the host's actual error. Do not weaken organizational policies or disable security controls to get a sample working. A report showing blank rows/configuration errors needs its bindings and metadata checked; a package import alone does not validate financial correctness.

## Internal distribution only

Keep this repository private. Distribute an artifact/report internally only after the applicable [host, tenant and legal checks](PUBLICATION-CHECKLIST.md) have explicit evidence/approval. Do not publish a repository, release, AppSource listing, license, privacy statement or support promise as a side effect of building.
