# Release-quality evidence and honest boundaries

## What changed from the first implementation

The initial 280px frozen row label covered every numeric column at a 258px tile width. The release-quality layout adapts the label width, separates period and scenario headers, keeps period captions visible while horizontally scrolling, and uses a compact footer with an explicit Help disclosure. Below 256 x 160 it asks for more space instead of presenting an unreadable statement. The no-field state now explains binding and offers copyable metadata.

Rows are vertically windowed rather than rendering the entire bounded statement into the DOM. A real 1000-position browser sweep covers row boundaries and half-row offsets while cycling horizontal start/middle/end. Offscreen keyboard focus loads the target window without changing its model identity. This is finite coverage of the defined sweep, not proof of every possible subpixel scroll position on every device.

Numerical improvements reject ambiguous duplicate JSON keys, describe schema errors by entry/ID, preserve modern matrix grouping semantics, merge complementary authoritative subtotal slots without addition, and leave invalid/zero-reference relative comparisons neutral. A 16-digit test exposed chart-axis scientific fallback overriding an explicit statement format; the visual now uses the SDK's non-abbreviating default formatter, preserving explicit large-integer and tiny-decimal patterns. Duplicate formatting work per rendered cell was removed. Named statement totals, rates and distinct counts are still model results, never sums of displayed rows.

## Reproduce locally

```powershell
npm ci
npx playwright install chromium
npm run verify
npm run audit:tooling
npm run test:evidence
```

No GitHub Actions, GitHub-hosted CI/CD, cloud coding or Codespaces build is part of this process. Initial tool/browser acquisition and advisory lookups can use the network; the visual runtime cannot.

The complete `npm run release:local` gate also generates the bound project and invokes the official local TMDL parser (requires .NET SDK 8 or newer). Schema checks are complemented by actual TMDL deserialization and by decoded SQ text-literal/resource/binding checks; this still does not execute M/DAX or open Desktop.

The ordinary packaged-browser suite covers 80 x 80, 258 x 198, 398 x 298, 1280 x 620 and 1366 x 768; row/horizontal scrolling, sticky geometry, long captions/numbers, partial/invalid/no-field recovery, multiple instances, RTL, high contrast, touch tap/pan, keyboard focus, reduced motion and selection/context identities. A 20,000-row supplied input is handled with the explicit 1,000-row bound/partial notice, and positive/negative exactly representable 16-digit integers plus tiny decimals exercise formatting. This does not claim that 20,000 rows are displayed, or that IEEE-754 numbers can recover digits absent from host-supplied numeric values. Native review must accept the declared bounded contract under Marketplace policy 1180.2. Three additional screenshot assets show the final package rendering supplied synthetic P&L, balance-sheet and cash-flow inputs at 1366 x 768.

## Performance methodology

`npm run test:evidence` writes `dist\quality\performance.json` with package SHA-256, timestamp, Chromium/Node/OS/CPU/memory details and all raw measurements. Five workloads cover P&L (18 x 21), practical statements (250 x 7), maximum rows (1000 x 21), exact maximum cells (1000 x 24), and maximum columns (142 x 168). Each has three warmups and 30 retained observations. Percentiles use nearest rank; no outliers are removed.

| Metric | Measured boundary | Excluded |
| --- | --- | --- |
| Synchronous render | Mock host renderingStarted to renderingFinished around real visual update. | Browser paint, model query and native host overhead. |
| Render-to-frames | Actual visual.update through two requestAnimationFrame callbacks. | Prebuilt input transfer/model query and native host overhead. |
| Scroll-to-frames | Real scrollTop/scrollLeft change through virtual-window scheduling and two frame callbacks. | Physical gesture/driver transport and native embedding overhead. |
| Selection-to-frames | DOM cell click through real visual selection styling and two frame callbacks. | Physical input and asynchronous native host filtering; host acknowledgement is immediate in the mock. |

These are **shared/possibly contended-machine observations**, not production latency guarantees. At a 60Hz frame cadence, two-frame observations have a natural approximately 33ms floor; this is not 33ms of CPU work. Report p50/p95/max together with raw samples and caveats. The 168-column workload has substantially higher layout cost because columns are not horizontally virtualized. Reduce periods/variance columns for interactive wide statements; do not describe the maximum shape as unlimited or uniformly fast.

## Evidence versus native acceptance

Packaged Chromium execution is real, including scroll positions and computed layout. Its Power BI host, selection acknowledgements, context menu and tooltip services are mocked. Synthetic expected results/literals are inputs; browser execution does not run M or DAX. Runtime request interception rejects and records requests, but does not prove every unexecuted path is safe. The static/package audits complement it.

Candidate listing screenshots show real packaged UI with no fabricated host chrome. They are not native Desktop/service screenshots. The coordinator must accept or replace them after the bound offline project opens/refreshes in Desktop and is saved as a genuine PBIX.

Remaining host gates include real query/subtotal shapes, cross-filter/highlight, report-page tooltips, host drillthrough, bookmarks/save/reset, screen-reader behavior, tenant policies, service rendering and native export. Export may show only the current bounded viewport; no full-statement pagination or paginated-report equivalence is promised.

## Concrete comparison, not a superiority claim

The [primary-source research](RELEASE-RESEARCH.md) records sources, dates and access failures. Vendor documentation establishes advertised capabilities, not equivalent implementations or an independent product evaluation.

| Reference | Demonstrated difference for this release |
| --- | --- |
| Native Power BI matrix | Native field-driven authoring, hierarchy exploration and column-width controls are easier than hand-authoring JSON. Atlyn adds an explicit line-by-line semantic contract, displayed-sign favorability and percent-point policy, but has fewer authoring controls and only local delivered-row collapse. |
| Paginated reports | Paginated reports can print every row across pages. Atlyn is an interactive bounded viewport, not a substitute for complete printable financial statements. |
| Zebra BI Tables | Vendor sources advertise richer inline charts, authoring controls and financial comparisons. Atlyn's demonstrated strength is transparent, tested model-authoritative numbers and explicit failure/partial-data states; it has no embedded charts, formula editor or equivalent feature-breadth claim. |
| Inforiver documentation | Vendor documentation describes a much broader reporting/planning product family. Atlyn intentionally excludes data entry, writeback, collaboration and formulas; this reduces scope, not proof of superior usability or security. Edition-specific feature/licensing parity was not established. |
| PowerFin | Primary product/vendor evidence could not be verified from this environment. No feature, publisher or quality comparison is asserted. The coordinator must supply or verify an authoritative accessible product source before making a concrete comparison. |

Known gaps remain strict JSON authoring, finite hierarchy/period bounds, maximum-width layout latency, unpersisted local collapse, viewport-only export, and native-host acceptance. Calling this candidate "best-in-class" would not be supported by the evidence.
