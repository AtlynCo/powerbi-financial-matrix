# Publication and host acceptance checklist

This is a **gate list, not a declaration that checks have passed**. The repository is private and no public release/AppSource action is authorized. Record actual evidence, artifact digest, date, Desktop/service build and tenant for each applicable check.

## What each kind of evidence proves

| Evidence | Establishes | Does not establish |
| --- | --- | --- |
| Typecheck/lint/unit tests | Local code and tested transformation rules meet assertions. | Power BI host integration or accounting policy approval. |
| SDK packaging + artifact validation/hash | A specific package has the checked structure/identity/content. | Certification, distribution rights or tenant approval. |
| Packaged-browser harness | Packaged JavaScript/CSS execute against a **mocked** host in Chromium; the asserted rendering/interactions work there. | Real Power BI query shape, filtering, native tooltips/highlights, drillthrough, accessibility, export or bookmarks. |
| Offline sample sources/expected results | A reproducible intended model/report design and an independently checkable arithmetic baseline. | Execution/validation by Desktop's M/DAX engines. |
| Static certification-oriented audit | The scripted checks passed for that build. | Microsoft certification, AppSource acceptance, IBCS compliance or a complete security review. |

Do not replace an unchecked Desktop/service item below with a mock-browser screenshot.

## Reported development snapshot

**2026-09-09, local implementation validation:** **18 semantic unit tests**, **9 packaged Chromium tests**, strict typecheck and lint passed. The Chromium tests load JavaScript/CSS from the actual `.pbiviz` artifact and include real wheel scrolling on both axes, sticky positioning, resize/RTL, identities, collapse, mixed host-format handling and the checked-in P&L's supplied expected inputs. The browser is real; the **Power BI host is mocked**. This is not Desktop/service, M/DAX-engine or end-to-end tenant evidence.

The actual package ZIP, manifest, icon and localization checks passed, as did the official SDK external-requests audit and the repository's custom audit. The build-isolation wrapper was exercised and its named certificate/key/passphrase cleanup confirmed. A review finding affecting diagnostic visibility after a clean-to-invalid transition was fixed. None of these results is Microsoft certification, an approval to publish, or a guarantee that forced process termination executes cleanup.

The source-only sample checker also passed **526 assertions** for the supplied literal data, metadata and expected arithmetic. It does not execute M/DAX.

Both **`npm audit --omit=dev` and the full `npm run audit:tooling` reported 0 advisories** in the final run. Earlier development-only findings were addressed using maintained `tsx` 4.23.13 and the development-graph `qs` 6.16.0 / SockJS-scoped `uuid` 11.1.1 overrides documented in the build guide. Zero known advisories at this snapshot is not a blanket security guarantee; preserve the outputs and reassess after lockfile changes or advisory updates.

The private Windows CI workflow mirrors verification and the full tooling audit, uploads only the package/hash/validation reports, and has no publication step. Workflow source existence does not establish that a remote CI run has passed; retain that run's evidence separately.

## Reproducible package gate

- [ ] Record commit, Node/npm versions and lockfile used.
- [ ] Run `npm ci`, provision Chromium, and run `npm run verify`; preserve logs and investigate failures.
- [ ] Run/review `npm run audit:tooling`; triage build-only advisories separately from runtime issues.
- [ ] Record exact `.pbiviz` SHA-256; validate frozen GUID and `1.0.0.0` version.
- [ ] Review the finalized build wrapper's worktree-isolated development-certificate generation and cleanup; no user trust-store installation or cross-checkout secret reuse.
- [ ] Confirm runtime `privileges: []`, `externalJS: []`, no runtime network/auth/license/writeback, and no embedded credentials.
- [ ] Review generated third-party notices for runtime bundled dependencies.
- [ ] Confirm original 20 × 20 icon, attribution and rights; no borrowed branding.
- [ ] Verify generated artifacts remain ignored and the repository remains private.

## Desktop model/report gate — pending until run in Desktop

- [ ] Recreate the sample using only its inline M/DAX/JSON sources, without external data or machine-specific paths.
- [ ] Record Desktop version, locale, chosen numeric-format locale and package digest.
- [ ] Verify relationships and disconnected line tables; no implicit measures or line-to-fact relationship.
- [ ] Bind all three numeric scenario measures and the Period column; do not bind a Scenario grouping.
- [ ] Verify both hierarchy levels are delivered, including heading parents; verify direct or host-child row subtotal values and no fabricated parent totals.
- [ ] Check all three periods against the sample expected-results file, including raw-sign expenses, model margins, distinct counts, named subtotals, missing Prior and zero Budget comparison.
- [ ] Check a single-leaf filter, a parent-only query, no Period binding, and one to six hierarchy levels using an appropriately modeled extension.
- [ ] Verify duplicate/missing IDs and bad metadata produce understandable errors; verify percent `both` and heading variances are rejected.
- [ ] Confirm statement grand totals and automatic period totals are absent.
- [ ] Verify local expand/collapse only changes delivered descendants and does not imply host expansion.
- [ ] Exercise large row/period requests and segmented host results; notices remain visible and no implicit fetch/merge occurs.
- [ ] Recreate optional BS/CF pages; check snapshot/nonadditive behavior and each contiguous cash bridge.

## Desktop and service interaction gate — pending in both hosts

- [ ] Mouse row/cell selection, Ctrl/Cmd multi-select and Escape clear; verify actual cross-filter/highlight behavior with another visual.
- [ ] Base-cell row + period + measure identity and variance row + period identity; no fictional variance measure.
- [ ] Native tooltips and report-page tooltips with required context, plus host highlight values.
- [ ] Host context menu and eligible **host-defined drillthrough** destination; check both keyboard and pointer invocation.
- [ ] Arrow/Home/End/PageUp/PageDown navigation, Enter/Space selection, `+`/`-`, Shift+F10, tab entry/exit and visible focus.
- [ ] High-contrast themes, 200% zoom, screen-reader announcement/navigation and non-color interpretation of favorability.
- [ ] Long captions, mixed numeric formats, negative/zero values, missing/invalid values, local culture and RTL presentation.
- [ ] Sticky header/first column and scrolling in narrow/wide host viewports; no clipped focus or unreachable bounded cells.
- [ ] Slicers, external cross-filtering, report/page/visual filters and RLS roles do not leak data or create misleading totals.
- [ ] Save/reopen, bookmarks, reset-to-default, personal bookmarks and persistent filters behave as intended; local collapse is not assumed to be a persisted native hierarchy state.
- [ ] Export data, PDF/PowerPoint, print, subscriptions and accessibility/tenant restrictions are assessed explicitly; never imply full-data export from bounded DOM scrolling.
- [ ] Service import/render under intended tenant policies, browser support and refresh policy. Test embedded/mobile surfaces only if they are to be supported.

Use a destination with the bound fields StatementLines[LineID] and Period[Period] as drillthrough fields to test **identity transport**. Because StatementLines is disconnected, that alone does not filter account transactions. Verify any production account-level drillthrough through an explicitly designed mapping/measure; do not promise automatic account inference.

## Accounting and data-owner gate

- [ ] Model owner approves account mappings, sign convention, display favorability, comparator alignment and period semantics.
- [ ] Every subtotal, rate, distinct count, balance and cash-flow line has an explicit authoritative measure.
- [ ] Multi-currency conversion, scenario reconciliation, consolidation and missing-data rules are handled in the semantic model where required.
- [ ] Sample values are understood to be synthetic, not an accounting-standard/template guarantee.

## Legal, organizational and public-distribution gate

Configured package metadata is **Atlyn <atlyn.help@gmail.com>**, with support URL **https://www.atlynco.com/docs/faq**. The coordinator supplied these existing shared Atlyn details and confirmed the FAQ content. This establishes metadata provenance, not monitored support, responsiveness, a service commitment or approval to publish this visual.

- [ ] Legal owner selects/approves original-code license terms. No license is inferred from repository visibility or third-party notices.
- [ ] Legal approves third-party licensing/attribution and any proposed end-user terms.
- [ ] Verify ownership, mailbox monitoring, support responsiveness and the FAQ's suitability for Financial Matrix; record evidence and the responsible support owner.
- [ ] Legal/organization approves applicable privacy contacts, privacy statements and support obligations; do not infer these from the configured author email or FAQ.
- [ ] Product/security/tenant owners approve intended internal distribution and operational support.
- [ ] Any external distribution has separate explicit approval. Until then: **no public repository, public release or AppSource submission**.
- [ ] If certification or standards claims are later desired, complete their actual review process before making those claims.

## Evidence record template

Copy into your approved internal tracking system; do not include private tenant/user data in a public issue.

```text
Artifact filename / SHA-256:
Source commit:
Build + audit commands / outcomes / date:
Desktop build / OS / locale:
Service tenant environment / browser / date:
Sample source checks:
Desktop M/DAX execution + expected-result comparison:
Interaction/accessibility/export evidence:
Outstanding issues / limitations:
Model owner approval:
Support owner / monitoring / responsiveness evidence:
Legal / licensing / distribution approval:
```
