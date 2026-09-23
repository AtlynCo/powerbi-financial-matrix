# ![Atlyn icon](assets/icon.png) Atlyn Financial Matrix

A read-only Power BI custom visual for model-authored financial statements. Version **1.0.2.0** presents actual, budget and prior measures, explicitly configured lines, and opt-in variances. It is a **presentation layer, not an accounting engine**: the semantic model supplies every value, including subtotals, percentages, distinct counts, balances and cash flows.

**Private development repository.** Marketplace preparation is in progress; only the release coordinator performs native-host acceptance and live submission. The owner-approved commercial model is **existing Atlyn storefront subscriptions with an ungated visual runtime**. No public release, certification, IBCS compliance, or new source-code license is implied. See the [publication checklist](docs/PUBLICATION-CHECKLIST.md) for the remaining host and legal gates.

## Start here

- [Build, package and import](docs/BUILD-AND-IMPORT.md)
- [Authoring contract, formatting and interactions](docs/AUTHORING.md)
- [Recreate the offline sample in Power BI Desktop](samples/README.md)
- [Build the fully bound offline PBIP](docs/PBIP-SAMPLE.md)
- [Balance-sheet and cash-flow patterns](samples/patterns/README.md)
- [Host validation and publication checklist](docs/PUBLICATION-CHECKLIST.md)
- [Release-quality evidence and limitations](docs/RELEASE-QUALITY.md)
- [Submission dossier](docs/SUBMISSION-DOSSIER.md)

The sample contains **Power Query M, DAX, line-metadata JSON and expected results**. All sample data is synthetic and embedded in the query sources; refresh needs no network, credentials, external connector, or machine-specific path. Building the visual and installing Power BI Desktop are separate prerequisites. Desktop/service validation remains pending; source and mocked-browser validation are not equivalent to it. See the submission dossier for the bound project and the separate native PBIX conversion gate; no PBIX is fabricated.

## Bind the visual

| Role | Binding |
| --- | --- |
| **Line ID hierarchy** (`Lines`) | One to six text ID columns, outermost first. IDs are stable and globally unique across delivered hierarchy paths. |
| **Period** | Optional single grouping column. |
| **Actual** | Required numeric measure. |
| **Budget** | Optional numeric measure. |
| **Prior period** | Optional numeric measure. |

Scenarios are **separate bound measures**, not a scenario grouping. Paste an explicit metadata array into **Format visual → Statement → Line metadata JSON**. The no-field landing page explains these steps and supplies a copyable starter. Use the [JSON Schema](samples/line-metadata.schema.json) for editor assistance; runtime validation additionally checks delivered IDs and sibling orders. Every delivered non-host-subtotal node, including section parents, needs metadata. No accounting meaning is inferred from labels.

```json
[
  {"id":"pl.revenue","label":"Revenue","order":10,"type":"subtotal","unit":"currency","format":"$#,0;($#,0);$0","sign":1,"favorable":"higher","variance":"both"},
  {"id":"pl.materials","label":"Materials","order":20,"type":"detail","unit":"currency","format":"$#,0;($#,0);$0","sign":-1,"favorable":"higher","variance":"both"},
  {"id":"pl.gross-margin","label":"Gross margin","order":30,"type":"detail","unit":"percent","format":"0.0%;(0.0%);0.0%","sign":1,"favorable":"higher","variance":"absolute"}
]
```

This short array illustrates the schema, not the complete sample configuration. Use [the sample's full metadata](samples/pnl/line-metadata.json) when following its assembly instructions.

## Financial and interaction boundaries

- Display sign is applied **once** to model values. Favorability refers to the **displayed** delta. Negative displayed expenses therefore normally use `favorable: "higher"`.
- Absolute variance is displayed actual minus displayed reference. Relative variance divides that delta by the absolute displayed reference; a zero reference yields **N/A**, including zero against zero. Percent-line absolute variance is in **percentage points**, not relative percent.
- Missing values display `-`; non-finite values display `!`. Neither is replaced with zero. Headings have no displayed numbers. The visual never sums children, ratios, distinct counts or presentation subtotals.
- A vertically windowed table provides frozen period/scenario headers and responsive row labels, keyboard navigation, local expand/collapse, selection, native tooltips/highlights and a host context menu. A **256 x 160** viewport is the minimum for a readable grid; smaller tiles show an explicit resize message. Collapse affects **already delivered descendants only**, not query expansion or persisted bookmark hierarchy state.
- Automatic statement grand totals and period totals are not displayed. Bounds are **1,000 row nodes, 24 periods, 168 value columns and 24,000 displayed row × column cells**. Incomplete/oversized data produces notices; no segment fetching/merging or collapse-based recovery is attempted. Scrolling is not full export.
- Runtime requests no privileges (`privileges: []`), loads no external JavaScript (`externalJS: []`), and has no network, authentication, licensing check or writeback path. Build-time dependency downloads are separate.

## Storefront acquisition, runtime and source terms

**Owner decision, 2026-09-10:** acquisition uses existing Atlyn storefront subscriptions; the installed visual intentionally has no runtime entitlement enforcement. Shared report viewing is free of an additional Atlyn viewer charge or activation step. The visual does not verify a paid author either: no license keys, signer, Microsoft Entra ID/AAD sign-in, licensing API, feature gates or runtime requests are to be added. Power BI's own licensing, report permissions and tenant policies still apply.

Verified 2026-09-23 against Atlyn's published [customer Terms](https://atlynco.github.io/atlyn-powerbi-support/legal/terms/): Financial Matrix is one of Atlyn's eight additional all-access visuals. The package's technically ungated runtime does not by itself authorize use — those Terms require an author to hold an **active paid or trialing Atlyn all-access subscription**; shared-report viewers do not need a separate Atlyn subscription. This is a legal-authorization requirement layered on top of the unchanged technical/runtime behavior described above, not a new key, signer, sign-in or feature gate.

Runtime licensing integration is **not a release blocker**. The additional **Power BI certification badge is a required release goal**, not an awarded status or a badge to fabricate. The coordinator owns the genuine PBIX/native acceptance, final assets, legal/listing fields and Microsoft submission. Further merges, certification-ref updates and submission remain on coordinator hold.

**Existing first-party license status:** no first-party `LICENSE`, `LICENCE` or `COPYING` file is present, and `package.json` declares no `license` identifier. No first-party license terms are introduced or changed here; storefront approval does not itself supply source-code redistribution terms. Third-party dependency notices and Microsoft's source-schema MIT license apply only to their respective materials. Legal approval of distribution rights and listing terms remains separate from the approved ungated-runtime architecture.

This documentation-only decision does not require repackaging or a version bump. Preserve the package identified above and frozen dossier; coordinate any later package-content change separately.

## Development quick start

Use Node.js **22.12 or newer**, npm, and **PowerShell 7 (`pwsh`) on PATH for Windows builds**, from the repository root:

```powershell
npm ci
npx playwright install chromium
npm run verify
```

The browser download is a **build/test-time** prerequisite only. `verify` includes typecheck, lint, unit tests, offline sample-source checks, packaging/artifact validation, packaged-browser tests, certification-oriented static checks and production dependency audit. Tooling audit is available separately as `npm run audit:tooling`. A successful audit is not Microsoft certification or a security guarantee.

`npm run test:evidence` captures three real packaged-browser statement screenshots and raw render/scroll/selection distributions. All gates are local: **no GitHub Actions, GitHub-hosted CI/CD, cloud coding or Codespaces builds**.

`npm run package` builds a real SDK `.pbiviz` and validates its identity/content, writing a SHA-256 sidecar under ignored `dist`. The frozen visual GUID is `AtlynFinancialMatrixCA42B8646E934AF1B6252CB8E39C0D71`. See [the build guide](docs/BUILD-AND-IMPORT.md) before importing the package; generated artifacts are not committed.

Third-party dependency notices, including embedded Globalize notices, are maintained in [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt) and embedded in the packaged `ThirdParty_Notices` localization resource. Those notices do not grant a license for this repository's original code. Existing Atlyn author/contact metadata is documented in the [build guide](docs/BUILD-AND-IMPORT.md); it does not establish monitored support or publication approval. Legal ownership, license terms, operational support, privacy obligations and distribution approval must be settled before publication.
