# Financial Matrix submission dossier

**Status: private technical candidate, not submitted or certified.** The release coordinator owns real Desktop/service acceptance, Partner Center access, publication and legal/product decisions. This repository performs local preparation and source delivery only. No GitHub Actions or other GitHub-hosted CI/CD, cloud coding, Codespaces build, public release or privacy change is authorized here.

## Immutable delivery

The final dossier manifest records the exact source commit, official `.pbiviz` SHA-256, full source ZIP, bound offline PBIP, original assets, screenshots, raw performance observations and command logs. Preserve the complete generated dossier in the coordinator's approved durable location. Hashes identify bytes, not Microsoft approval.

| Item | Identity or location |
| --- | --- |
| Display name | Atlyn Financial Matrix |
| Visual GUID | `AtlynFinancialMatrixCA42B8646E934AF1B6252CB8E39C0D71` |
| Version | `1.0.0.0` |
| Repository | Private `AtlynCo/powerbi-financial-matrix`, one visual only |
| Certification source | Lowercase `certification` at exactly the candidate source commit; coordinator freezes it for submission |
| Runtime package | Official SDK package in ignored `dist`, not a hand-edited archive |
| Source | Full unminified TypeScript, scripts, lockfile, examples and documentation in the source archive |
| Icon / listing logo | Original `assets\icon.png` (20 x 20 PNG), `assets\logo.png` (300 x 300 PNG), editable original SVG |
| Screenshots | Three actual packaged renders in `dist\submission-assets`, each 1366 x 768 PNG and at most 1024KB |
| Offline report project | [Bound PBIP documentation](PBIP-SAMPLE.md); final custom visual embedded by the local generator |
| Required sample PBIX | **Pending genuine Desktop open/refresh/save by coordinator; PBIP is not a substitute** |
| Notices | Full shipped dependency notices embedded in each package's `ThirdParty_Notices` resource and supplied separately |

The source branch must not move underneath a submitted candidate. Do not force-push or overwrite another owner's `certification` ref. If changes are required after review/submission, the coordinator selects a new candidate and repeats all applicable gates rather than silently replacing submitted bytes.

## Local reproduction and evidence

The complete release gate additionally needs .NET SDK 8 or newer for Microsoft's local TMDL parser. The parser's pinned NuGet lockfile, isolated cache paths and exact scope are described in [PBIP sample](PBIP-SAMPLE.md); no M/DAX engine or shared Desktop UI is invoked.

```powershell
npm ci
npx playwright install chromium
npm run icons
npm run release:local
npm run dossier
```

`release:local` records each command/output/exit code locally: the documented Microsoft `eslint` command, typecheck/lint/model/sample tests, official packaging and artifact checks, packaged-browser suite, production/full tooling audits, bound-project generation/validation, real screenshots and benchmark capture, and evidence validation. For an immutable dossier, commit all source first and rerun with a clean worktree; the evidence manifest must name that exact commit/package. `dossier` receives the generated PBIP root, refuses dirty/mismatched source or an existing output directory, and writes a new manifest/source/project/assets/evidence bundle under `dist\dossier`. No automatic remote execution or publication occurs.

`eslint-plugin-powerbi-visuals` is explicitly installed and its recommended rules apply to distributed `src` code. General TypeScript/ESLint rules also inspect development scripts/tests; build-only filesystem/network operations are not falsely characterized as runtime visual capabilities. The exact documented script `npx eslint . --ext .js,.jsx,.ts,.tsx` is available as `npm run eslint`.

See [release-quality methodology](RELEASE-QUALITY.md) for sample counts, p50/p95/max boundaries, shared-machine caveats, real scroll coverage and mocked-host limitations. Screenshot provenance and benchmarks are bound to the final package digest. Browser suites are not native host proof.

## Candidate listing text for owner review

**Name:** Atlyn Financial Matrix

**Short description:** Read-only financial statements with explicit line order, model-supplied totals and transparent scenario variances.

**Description:** Present model-authored profit-and-loss statements with Actual, Budget and Prior measures in a structured financial table. Configure stable line IDs, captions, sibling order, row types, numeric formats, signs and favorable direction explicitly. Currency, ordinary numbers, model-defined margins and distinct counts can coexist without summing statement rows.

Eligible lines can show absolute and relative scenario differences. Margin differences are percentage points; zero-reference relative comparisons are N/A, and missing/invalid values remain distinct from zero. Named statement subtotals and matrix-provided totals remain authoritative model results. Included synthetic sources also demonstrate balance-sheet snapshots and a cash-flow bridge using the same presentation contract.

Frozen row/period headers, vertical row windowing, local expand/collapse, keyboard navigation, high-contrast/RTL presentation and native host identity APIs support report interaction. Local collapse affects delivered descendants only. Power BI controls native selection, tooltip and context-menu/drillthrough behavior.

**Disclosed limitations:** read-only; not an accounting, planning or spreadsheet engine. No formula language, DAX/JavaScript evaluation, writeback, forecasts, approvals or licensing service. Maximum 1,000 bounded row nodes, 24 periods, 168 value columns and 24,000 row x value-column cells; partial data is disclosed. Minimum readable grid 256 x 160. Columns are not horizontally virtualized; maximum-width statements are slower than typical views. Export may capture only the current viewport, not a complete paginated statement. All calculations/account mappings/currency conversion belong in the semantic model. Native-host acceptance is required before this candidate copy becomes a publication claim.

**Categories/industries:** coordinator chooses from current Partner Center lists; no category, pricing, IAP tier, licensing promise or commercial approval is invented here. Do not include competitor names, logos, comparative tags or superiority/certification claims in the listing. The [primary-source comparison](RELEASE-RESEARCH.md) is private research, not listing copy.

## Screenshot inventory and provenance

| File | Suggested descriptive caption |
| --- | --- |
| `screenshot-pnl.png` | P&L: explicit statement order, named model totals, currency, margins, distinct counts and scenario variances. |
| `screenshot-balance.png` | Balance sheet: supplied period-end stocks, named totals and explicit balance check. |
| `screenshot-cashflow.png` | Cash flow: supplied opening cash, activity movements, net change and closing-cash bridge. |

These images are the real final `.pbiviz` JavaScript/CSS rendered in Chromium with synthetic checked-in expected inputs and a mocked Power BI host. They contain no fabricated Desktop/service chrome. They do not execute M/DAX or establish native report correctness. The coordinator must accept these candidate assets or replace them with final native captures after report acceptance; preserve replacement hashes/provenance. The colored 300px logo is an **external listing asset**, not an in-visual promotional logo or watermark.

## Current Microsoft requirements and remaining owners

Primary requirements were read on 2026-09-09: [publishing assets](https://learn.microsoft.com/en-us/power-bi/developer/visuals/office-store), [certification](https://learn.microsoft.com/en-us/power-bi/developer/visuals/power-bi-custom-visuals-certified), [Marketplace policy 1180/1200](https://learn.microsoft.com/en-us/legal/marketplace/certification-policies), and [offer properties](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual-properties). Requirements can change; recheck before live submission. The full cited analysis and access failures are in [release research](RELEASE-RESEARCH.md).

| Gate | Responsible owner / required evidence |
| --- | --- |
| Genuine offline sample `.pbix` | Coordinator: open fully bound PBIP in Desktop, refresh all inline tables, compare P&L/BS/CF measures with expected results, save actual PBIX and hash it. No renamed ZIP or fake PBIX. |
| Native Desktop/service/device acceptance | Coordinator: supported versions/browsers, matrix subtotal/query shapes, filtering/RLS/highlights/tooltips/context menus, bookmarks/save/reset, focus mode/pinning, touch/mobile and supported host surfaces. |
| Large-input/precision policy | Coordinator/reviewer: accept disclosed bounds against policy 1180.2. Local 20,000-row input is clipped truthfully, **not** a 20,000-row display claim; representative exactly representable 16-digit values are exercised. |
| Microsoft sample test data | Coordinator: exercise the [official sample report](https://github.com/PowerBi-Projects/PowerBI-visuals/tree/gh-pages/assets) in the real host as required by certification guidance; synthetic fixtures do not replace that host gate. |
| Accessibility and native exports | Coordinator: real screen readers/zoom, PDF/PowerPoint/print/subscription/export behavior; viewport limitations must remain explicit. No full-statement pagination claim. |
| Private certification repository access | Coordinator: approved Microsoft validation-team read access, account/2FA/recovery requirements, exact frozen lowercase branch and submitted package match. Never place credentials in source/dossier. |
| Original-code license and distribution rights | Legal owner: select/approve terms. Third-party notices do not license Atlyn's original code or authorize public distribution. |
| EULA / contract | Legal owner: choose the applicable Microsoft standard contract or approved EULA/URL; do not silently accept a contract during preparation. |
| Privacy policy HTTPS URL | Legal/privacy owner: approved public policy and contact, separate from support FAQ. No runtime network does not waive the listing requirement. |
| Pricing / IAP / business model | Product/legal owner: approve free base visual / any permitted IAP policy. Current code has no purchase, activation or licensing path. |
| Support operations | Support owner: approve Financial Matrix support documentation, monitoring/responsiveness and ownership. Existing metadata is `Atlyn <atlyn.help@gmail.com>` and `https://www.atlynco.com/docs/faq`; metadata is not proof of operations. |
| Listing/assets and final submission | Coordinator: approve copy, categories, screenshots, rights, preview audiences and all required Partner Center fields; upload actual immutable files and request certification. This session does not manipulate shared UI or submit. |

The complete native/manual scenarios and evidence template are in the [publication checklist](PUBLICATION-CHECKLIST.md). Unchecked gates are real blockers, not implied passes.
