# Release research: certification, AppSource submission and comparable visuals

**Access date for every citation in this document: 2026-09-09**, unless a citation explicitly says otherwise (for example, an archived snapshot with its own capture date). This document is independent research only. It does not certify, approve, endorse, or predict the outcome of any Microsoft certification or AppSource review, and it makes no legal, licensing, or "best-in-class" claims. See [`PUBLICATION-CHECKLIST.md`](PUBLICATION-CHECKLIST.md) for the authoritative gate list and current unmet gates; this document supplies research context for that checklist, it does not replace or relax it.

No GitHub Actions/hosted CI, cloud build, or shared Desktop/browser UI was used to produce this research. All fetches below were made with local, read-only web browsing. Where a fetch failed, that failure is recorded verbatim rather than filled in with an assumption.

**Owner decision update, 2026-09-10 (not a new Microsoft policy finding):** existing Atlyn storefront subscriptions with an ungated runtime and free shared viewing are approved. No paid-author enforcement or runtime licensing integration is pending. Although Microsoft's certification program is optional in general, the additional Power BI certification badge is required for this release by the owner; it has not been awarded. Current native, final-asset, legal/listing and submission gates are in the dossier/checklist. No first-party license file or package license identifier has been added or changed.

---

## 1. Microsoft primary sources: certification and AppSource submission

### 1.1 Certification requirements (optional program)

Source: [Get your Power BI visuals certified](https://learn.microsoft.com/en-us/power-bi/developer/visuals/power-bi-custom-visuals-certified) (`ms.date: 2025-12-15`, page fetched at listed access date).

- Certification is **optional**; an uncertified visual is not automatically "unsafe." Certified visuals unlock PowerPoint export and report-page-tooltip subscription email rendering that noncertified visuals don't get.
- **Code repository requirements**: the repository doesn't have to be public, but it must be reviewable by the Microsoft Power BI team, must contain code for **only one** visual, and must contain **a branch named `certification` (lowercase required)**; that branch's source must match the submitted package exactly and can only be updated on the next resubmission.
- **File requirements**: `.gitignore` must exclude `node_modules`, `.tmp`, `dist` (those folders must not be committed); the repo must include `capabilities.json`, `pbiviz.json`, `package.json`, `package-lock.json`, `tsconfig.json`. `package.json` must have `typescript`, `eslint`, and `eslint-plugin-powerbi-visuals` installed, and must contain a lint script literally `"eslint": "npx eslint . --ext .js,.jsx,.ts,.tsx"`.
- **Command requirements**: `npm install`, `pbiviz package`, and lint must all run clean; `npm audit` "must not return any warnings with high or moderate level."
- **Compiling requirements**: use the latest `powerbi-visuals-tools`; `pbiviz package --certification-audit` checks for unsafe `fetch`/`XMLHttpRequest`/`eval` calls, and `--certification-fix` can strip forbidden calls that originate in third-party libraries outside the author's control (not for code inside the author's own repository).
- **Source code — required**: only public, reviewable OSS components; support the Rendering Events API; sanitize DOM input; use the [official sample report](https://github.com/PowerBi-Projects/PowerBI-visuals/tree/gh-pages/assets) as a test dataset.
- **Source code — not allowed**: accessing external services/resources (any outbound HTTP/S or WebSocket call; `WebAccess` privileges must be empty/omitted), `XMLHttpRequest`/`fetch`, `innerHTML`/`D3.html()` with user data, any browser-console JS errors for any input, `eval()`/`Function()`/unsafe `setTimeout`/`requestAnimationFrame`/`setInterval` on user input, and minified JavaScript/projects.
- **Submission mechanics**: request certification from the Partner Center Product setup page; if the repo is private, create a dedicated validation-team GitHub account with 2FA and recovery codes, and grant read-only access to Microsoft's own `pbicvsupport` account.
- **Publication timeline**: a new visual submission typically appears on AppSource within hours but takes **10–14 days** to reach production; an update to an existing visual takes **up to two weeks**; a certification badge typically appears **within three weeks** of submission approval. Microsoft can remove certification at its discretion.

### 1.2 AppSource submission assets and metadata

Source: [Publish Power BI visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/office-store) (`ms.date: 2025-12-15`).

Required submission items (table paraphrased, all "Required = Yes" unless noted):

| Item | Requirement |
| --- | --- |
| `.pbiviz` package | `pbiviz.json` must contain visual name, display name, GUID, four-part version `x.x.x.x`, description, support URL, author name and email. |
| Sample `.pbix` report | Must demonstrate the visual's value/usage/formatting; **must work fully offline with no external connections**. |
| Logo | PNG, **exactly 300×300 px**, for the AppSource listing (review the [store images guide](https://learn.microsoft.com/en-us/office/dev/store/craft-effective-appsource-store-images) before submitting). |
| Screenshots | PNG, **1–5 images**, **exactly 1366×768 px**, **≤1024 KB** each. |
| Support URL | Required, must start with `https://`. |
| Privacy policy URL | Required, must start with `https://`. |
| EULA | Required — the [standard Marketplace contract](https://go.microsoft.com/fwlink/?linkid=2041178), the Power BI-visuals-specific EULA, or an author-supplied EULA. |
| Video link | Optional, must start with `https://`. |

Do not change a visual's GUID between submissions/updates; use Developer mode to test unpublished versions instead ([Testing submissions of Power BI custom visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/submission-testing), `ms.date: 2025-12-15`).

### 1.3 Icon and packaging specifics

Source: [Package a Power BI visual](https://learn.microsoft.com/en-us/power-bi/developer/visuals/package-visual) (`ms.date: 2025-12-15`).

- The Visualizations-pane icon referenced from `pbiviz.json`'s `assets.icon` **must be PNG, exactly 20×20 px**.
- `pbiviz package` (or an equivalent custom `npm run package`) produces the `.pbiviz` artifact under `dist/`.

**Repository fact-check (not a certification claim):** `assets/icon.png` in this repository measures **20×20 px**, and `assets/logo.png` measures **300×300 px** (verified locally with .NET `System.Drawing.Image` on 2026-09-09). There is no `.pbix` file anywhere in this repository (`glob **/*.pbix` returned no matches on 2026-09-09); the README and `docs/PUBLICATION-CHECKLIST.md` already state that a `.pbix`/`.pbip` sample is a separate, currently unmet gate, and another agent owns that offline PBIP track — this document does not change that ownership.

### 1.4 Commercial-logo and IAP guidelines (policy context, not a runtime enforcement requirement)

Source: [Guidelines for publishing Power BI custom visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/guidelines-powerbi-visuals) (`ms.date: 2025-12-15`).

- A Power BI visual submitted to AppSource can be free, or tagged "additional purchase may be required" (in-app purchase/IAP); **Marketplace policy 1180.1 requires the base visual itself to be free** (see §1.5).
- Commercial/company logos are **edit-mode only** (never shown in view/reading mode), must be **300×300 px PNG**, must render **grey `#C8C8C8`** with no gradients/strong shadows, and may only redirect to the vendor's site or open an info pop-up — never load arbitrary content.
- Watermarks may only appear on **paid** features being used without a valid license; they are not allowed on free IAP features.
- Best practice: submit a landing page, a short screen-recording, and a detailed functionality description (including high-contrast, report-page-tooltip, and drill-down support) — advisory, not mandatory certification gates.

### 1.5 Microsoft Marketplace certification policy sections 1180/1200 (legal source, not developer docs)

Source: [Microsoft Marketplace general listing and offer policies](https://learn.microsoft.com/en-us/legal/marketplace/certification-policies) (document version 1.67, dated 2024-08-26 per the page body; page metadata shows `updated_at: 2026-08-20`).

- **§1180.1 Acquisition, pricing, and terms**: "Power BI visuals must be free but can offer additional purchases," subject to the IAP guidelines in §1.4 above.
- **§1180.2 Functionality**: the visual must work in Power BI Desktop, Power BI Online/service, Power BI mobile apps, and Power BI Windows universal apps, on Power BI's supported OS/browsers/devices **including touch-only devices with no physical keyboard or mouse**; must support the context (right-click) menu; must support core Power BI functions such as pinning to a dashboard, filter/focus mode, and formatting multiple data types. Data-type tests explicitly include **string, empty, negative, "lots of rows (at least 20,000 rows)", and 16-digit large numbers**. The visual must not launch functionality outside itself without explicit user permission, must not prompt users to install additional files, must not solicit Microsoft-identity credentials outside an approved OAuth flow, must not open unrequested pop-ups, must not request unreasonably high/full-control permissions, and — the same clause repeated as in §1.2 — **"Power BI visuals must be accompanied by a sample file in `.pbix` format"** whose visual content matches the submitted `.pbiviz`.
- **§1200 Power BI visuals additional certification** restates the code-repository/quality/security/functionality bullets from §1.1 as binding policy language (1200.1.1–1200.1.4), and adds **§1200.1.5: "Power BI Visual additional certification does not apply automatically to updated visuals. All updates to certified Power BI Visuals must also be certified as part of the submission process."** §1200.2 clarifies that **only a visual with no external-service/resource dependency is eligible for certification**; a vendor may publish a separate certified (no external access) and noncertified (external access) build of the same visual side by side, provided the noncertified listing discloses the external dependency.
- General policy §100.1.3/§100.7 (applies to all Marketplace offer types, including Power BI visuals): the listing "must not simply repeat the offer summary," must disclose limitations/conditions before acquisition, and **"Comparative marketing, including using competitor logos or trademarks in your offer listing, or including tags or other metadata referencing competing offers or marketplaces, is not allowed."** This is a relevant, binding constraint on any future AppSource listing copy for this visual — it is not a license to make internal competitive comparisons like this document, but it does mean listing text (unlike this internal doc) cannot name or disparage Zebra BI, Inforiver, or Nova Silva.

### 1.6 Partner Center offer mechanics

Sources: [Planning a Power BI visual offer in Partner Center](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/marketplace-power-bi-visual) (`ms.date: 2025-07-28`) and [Configure Power BI visual offer properties](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual-properties) (`ms.date: 2025-01-15`).

- Publishing requires a Partner Center Marketplace account enrolled in the Marketplace program.
- The **Properties** page requires choosing up to **two Categories** (e.g., Comparison, KPI, Part-to-Whole, Other) and up to **two Industries** (e.g., Financial Services) from Microsoft's fixed lists.
- Legal/support info requires either accepting Microsoft's **standard Marketplace contract** (after which custom terms can no longer be used) or supplying an EULA URL — including the option to point at Microsoft's own boilerplate Power BI visual EULA PDF (`https://visuals.azureedge.net/app-store/Power%20BI%20-%20Default%20Custom%20Visual%20EULA.pdf`) — plus a **privacy policy URL** and a **support document URL** (must include `http://`/`https://`).

### 1.7 Native comparison points: Matrix visual and paginated reports

- [Create a Matrix Visual in Power BI](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-matrix-visual) (`ms.date: 2026-07-15`): the built-in Matrix visual supports multi-field row/column hierarchies with expand/collapse (including an author-controlled **Auto expand** setting and a consumer-facing **Explore** auto-expand default), **frozen row headers** (toggleable per report, with a transient per-session right-click override), and configurable column width/auto-size behavior (Fit to content / Grow to fit). It is a first-party, always-available, free visual requiring no separate certification, submission, packaging, or licensing step — it is simply present in every Power BI report.
- [What are paginated reports in Power BI?](https://learn.microsoft.com/en-us/power-bi/paginated-reports/paginated-reports-report-builder-power-bi) (`ms.date: 2025-12-01`): paginated reports (authored in the separate, free **Power BI Report Builder** tool) print/export **every row of a table across as many pages as needed**, unlike a Power BI report table/matrix, which only prints/exports the rows currently visible/scrolled into its bounded viewport. Paginated Matrix/Table/Chart/free-form-List report items support grouping, sorting, formulas/expressions, and multiple embedded data sources (including Power BI semantic models, Azure SQL/Synapse, Analysis Services, SQL Server via gateway, Oracle, Teradata); license requirements mirror ordinary Power BI reports (a free license can publish to My Workspace; Pro/PPU or a paid capacity is needed to share more broadly).

---

## 2. Comparable matrix/financial-table visuals (as vendors describe them)

These are the vendors' own factual/marketing claims from their own primary sources, recorded for feature comparison only. **No certification, IBCS-compliance, or "best-in-class" status is asserted or implied by including a claim here** — per §1.5, competitor names must not appear in any future AppSource listing copy for this visual regardless of what is written below for internal research purposes.

### 2.1 Zebra BI Tables

Source: `https://zebrabi.com/power-bi-custom-visuals/tables/` — the page's `<head>` metadata and body did not render as readable prose through this tool's markdown conversion (the page is a heavily componentized WordPress/Advanced-Visual-Composer layout); the following is drawn from the page's own `<meta name="description">`/`<title>` tags and from its WordPress REST API content field (`https://zebrabi.com/wp-json/wp/v2/pages/?slug=tables`), both fetched raw on 2026-09-09 and both first-party vendor text, not third-party summary.

- Page `<title>`: *"Zebra BI Tables: Advanced Power BI Matrix Visual for PL & Variance Reports."* Page `<meta description>`: *"Zebra BI Tables is the most powerful matrix visual for Power BI. Build P&L statements, financial tables, and variance reports with automatic calculations and full control."*
- From the page body (WP REST content field): *"Zebra BI Tables is by far the most powerful table/matrix visual in Power BI... Expand/collapse rows, reorder columns, do a P&L calculation, top N analysis and much more. Zebra BI visuals are the first and only IBCS-certified visuals for Power BI!"* — vendor's own IBCS claim, not independently verified here.
- Other body claims: automatic absolute/relative variance calculation "saving you weeks in developing advanced reports"; per-row/per-group **sign inversion** ("invert a group, rows, and all children within a group") for cases like Revenue vs. Costs where growth has opposite favorability; unlimited hierarchy levels with expand/collapse and right-click whole-level expand/collapse; described as "the world's first fully responsive [Power BI] visuals."
- Video titles embedded in the page's own `VideoObject` schema (titles only, not verified against actual video content) additionally reference: variance calculation, Top-N, a formula editor to "add new elements," multi-plan/forecast comparison, a cross-table layout, dynamic comments, displaying a measure as an inline chart with a chart/table toggle slider, custom measures, scenario-comparison switching, scaled groups, report-page tooltips, and negative-value formatting.
- **Access limitation**: the AppSource listing itself (`appsource.microsoft.com`) returned HTTP 403 for every URL attempted in this research (see §3), so pricing/licensing-model specifics (free vs. IAP tiers) could not be verified from the AppSource listing itself.

### 2.2 Inforiver Reporting Matrix

Source: `https://docs.inforiver.com/` (Inforiver's own GitBook-hosted documentation site, publisher Lumel; fetched via its Markdown mirror, e.g. `https://docs.inforiver.com/introduction-to-inforiver.md`, on 2026-09-09).

- Confirmed exact AppSource listing name: **"Inforiver Reporting Matrix"** — from `https://docs.inforiver.com/introduction-to-inforiver/get-started/installing-from-appsource.md`, which walks through searching AppSource for "Inforiver" and selecting "Inforiver Reporting Matrix," then entering **a license key** in the visual's format pane after adding it — i.e., **the AppSource-installed visual itself gates functionality behind a license key**, confirmed directly rather than inferred.
- From `introduction-to-inforiver/why-inforiver.md`: Inforiver frames itself as consolidating "planning, reporting & analytics" in one Power BI visual, positioned to replace external tools (named: Tableau, Spotfire, Qlik, Cognos, WebFOCUS, SAP, plus Excel-based forecast/budget workbooks and PowerPoint add-ins such as think-cell/Mekko Graphics — vendor's own competitive framing, not verified here). It states its visuals are **Microsoft-certified** (linking to Microsoft's own certification doc) and describes three stacked security layers: tenant/RLS, an Inforiver-level admin toggle (e.g., "can Inforiver users write to Snowflake"), and report-level per-user action permissions (comment, data-entry, scenario-creation). It advertises **no-code** authoring of forecast templates, financial statements, commenting/collaboration, and data write-back, plus a hierarchical/pivot "matrix" across row, column, and (its wording) "z" axes, small-multiple charts/tables, and lasso/reverse-lasso selection — vendor's own comparison to Tableau/Spotfire/Qlik, not verified here.
- From `working-with-inforiver/2.-displaying-information/basic-formatting/totals-and-subtotals.md`: row/column subtotals appear automatically once a hierarchy exists on that axis; an author-facing "Totals" menu can toggle grand totals/subtotals independently per axis, reposition them (top/bottom), **"split"** row subtotals (per-group subtotal blocks instead of one trailing row), and — only when report-level pagination is turned off (a "Single page" design-tab setting) and the layout isn't "Drilldown" — **freeze** the grand-total row at the top or bottom of the scrollable viewport.
- Use cases explicitly listed on the introduction page include: storytelling/annotations, free-form exploration, visualizations, commenting/collaboration, "formatted and paginated reports," spreadsheet-like pivot analysis, what-if simulation, visual-level formula/calculation authoring, write-back to databases/shared drives, manual data entry/capture, forecasting/planning/budgeting, and scheduling.
- **Access limitation**: the AppSource listing page itself (`appsource.microsoft.com/en-us/product/power-bi-visuals/inforiver.inforiver_matrixpbi`) returned HTTP 403; pricing tiers/edition names were not independently confirmed beyond the "license key" step shown in the install doc above.

### 2.3 PowerFin (product and publisher unverified)

**Access failure — no primary source could be reached or located for this product.** Nova Silva was an unverified search lead, not an established publisher attribution. Constructed URLs below are failed discovery attempts, not verified product/listing identities. Concretely, in this session:

- `https://appsource.microsoft.com/.../novasilva.powerfin-matrix` (constructed listing URL) returned **HTTP 403** (consistent with every other `appsource.microsoft.com` URL attempted in this session, including a generic AppSource browse URL — see §3; this looks like a blanket bot/anti-automation block on the whole `appsource.microsoft.com` host from this environment, not something specific to Nova Silva).
- `https://novasilva.com/`, `https://nova-silva.com/`, `https://novasilva.eu/`, and `https://www.powerfin.io/` all failed outright at the DNS/transport level ("No such host is known").
- `https://www.novasilva.com/` (with the `www` subdomain) **does resolve** but returned **HTTP 403** for the root path and for guessed product paths (`/powerfin-matrix`, `/products`); this appears to be the real corporate domain for a Netherlands-based company named Nova Silva (its Wayback Machine history — `web.archive.org/cdx/search/cdx?url=novasilva.com&matchType=domain` — shows Dutch-language BI/data-visualization blog posts from 2010–2019), but the live site actively blocks this tool's fetches.
- A full CDX (archive index) query against every historical `www.novasilva.com` URL the Wayback Machine has ever captured, filtered case-insensitively for "powerfin," returned **zero matches** — i.e., the Internet Archive has no record of a `novasilva.com` page ever mentioning "PowerFin" in its URL, across every snapshot it holds.
- GitHub's public repository-search API (`api.github.com/search/repositories`) found **zero repositories** for the queries `PowerFin Matrix`, `novasilva`, or `"nova-silva"`, and GitHub's code-search endpoint requires authentication this session doesn't have (401), so a source-repository check was not possible either.
- General web search fell back to unrelated results for every engine tried in this sandbox (Bing's rendered and RSS endpoints returned an unrelated San Diego BBQ restaurant for a quoted `"PowerFin Matrix"` query; DuckDuckGo's HTML/lite endpoints returned a bot-check error page instead of results), so no secondary confirmation of the product's current name, vendor, or feature set was possible through this tool either.

**Conclusion for this competitor: do not state any Nova Silva PowerFin Matrix feature as fact.** If this comparison is needed for a real submission decision, it needs a human with normal (non-sandboxed) browser access to Nova Silva's site and/or the AppSource listing directly; this document deliberately leaves that cell blank rather than inferring from the product name alone.

---

## 3. Access failures recorded during this research (explicit, not silently skipped)

| URL attempted | Result |
| --- | --- |
| `https://learn.microsoft.com/en-us/power-bi/developer/visuals/publish-visual` | HTTP 404 (correct current path is `.../developer/visuals/office-store`, used above). |
| `https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual` | HTTP 404 (correct current path is `.../marketplace-offers/marketplace-power-bi-visual`, used above). |
| `https://appsource.microsoft.com/en-us/product/power-bi-visuals/zebrabi.zebrabi_tables` | HTTP 403. |
| `https://appsource.microsoft.com/en-us/product/power-bi-visuals/inforiver.inforiver_matrixpbi` | HTTP 403. |
| `https://appsource.microsoft.com/en-us/product/power-bi-visuals/novasilva.powerfin-matrix` | HTTP 403. |
| `https://appsource.microsoft.com/en-us/marketplace/apps?product=power-bi-visuals` (generic browse page, not vendor-specific) | HTTP 403 — confirms the block applies to the whole host, not one listing. |
| `https://novasilva.com/`, `https://novasilva.com/powerfin`, `https://nova-silva.com/`, `https://novasilva.eu/`, `https://www.powerfin.io/` | DNS/transport failure ("No such host is known"). |
| `https://www.novasilva.com/`, `.../powerfin-matrix`, `.../products` | HTTP 403 (host resolves; requests blocked). |
| `https://docs.zebrabi.com/zebra-bi-tables/`, `https://help.inforiver.com/en/` | DNS failure ("No such host is known") — guessed doc-subdomain names that don't exist; real docs are at `docs.inforiver.com` (used above) and, for Zebra BI, `zebrabi.com/power-bi-custom-visuals/tables/` itself. |
| `https://inforiver.com/docs/reporting-matrix/` | HTTP 404 (guessed path; real docs live at `docs.inforiver.com`, used above). |
| Bing web search (rendered HTML and RSS output) for `"PowerFin Matrix" Power BI Nova Silva` | Returned unrelated results (an unrelated restaurant chain website) instead of relevant hits. |
| DuckDuckGo HTML (`html.duckduckgo.com`) and Lite (`lite.duckduckgo.com`) search | Returned a bot-check error page ("Please email the following code...") instead of results, for every query tried. |
| `https://api.github.com/search/code?q=PowerFin+Matrix` | HTTP 401 (code search requires authentication not available in this session; repository search, which doesn't require auth, was used instead and returned zero relevant hits). |
| Wayback Machine CDX search for any `novasilva.com` URL containing "powerfin" | Zero results (confirmed empty, not a fetch error). |

---

## 4. Financial Matrix: demonstrated strengths and gaps (from this repository's own README/docs/source)

This section is a factual read of **this repository's own current documentation and capability declaration** (`README.md`, `docs/AUTHORING.md`, `docs/PUBLICATION-CHECKLIST.md`, `capabilities.json`, `pbiviz.json`, `assets/`), cross-referenced against §1–§2 above. It makes no claim that any gap is a defect — several are **stated, intentional exclusions** per the README's "read-only... presentation layer, not an accounting engine" framing — and no claim that any strength is "best-in-class" or superior to a named competitor.

### 4.1 What this visual demonstrably does (source: `capabilities.json`, `README.md`, `docs/AUTHORING.md`)

- Strict model-authoritative contract: every displayed number (including subtotals, percentages, distinct counts, balances, cash flows) comes from a bound Power BI measure; the visual never sums, averages, or infers a total (`README.md`, "Financial and interaction boundaries"; `docs/AUTHORING.md`, "Model-first contract").
- Explicit, author-opted-in line metadata (`id`, `label`, `order`, `type`, `unit`, `format`, `sign`, `favorable`, `variance`) with hard validation (duplicate IDs, duplicate sibling `order`, invalid `both` on a percent line, etc. are rejected, not silently coerced) — `docs/AUTHORING.md`, "Statement format card."
- `privileges: []` and `externalJS: []` in `capabilities.json`, matching the certification "not allowed" list in §1.1 (no external service access, no external JS) — this is a real, verifiable structural alignment with that specific requirement, not a certification claim.
- Declared bounds are explicit and enforced: 1,000 row nodes / 24 periods / 168 value columns / 24,000 displayed cells, with a visible notice on clipping rather than silent truncation (`README.md`, "Financial and interaction boundaries").
- Supports host matrix subtotal requests (`subtotals.matrix.*` in `capabilities.json`), keyboard navigation, native tooltips/highlight, and a host context menu (`supportsHighlight`, `supportsKeyboardFocus`, `tooltips.roles`) — the context-menu support specifically matches the Marketplace §1180.2 functional requirement noted in §1.5.
- `assets/icon.png` (20×20) and `assets/logo.png` (300×300) already match the exact pixel dimensions required in §1.2/§1.3 — verified by this research, not merely asserted by the README.

### 4.2 Intentional, stated exclusions versus what §2's competitors advertise

These are differences in scope, not defects — the README explicitly frames the visual as read-only and model-authoritative, and `docs/PUBLICATION-CHECKLIST.md` explicitly defers accounting-engine behavior to the semantic model:

- **No data write-back, manual data entry, scenario/snapshot creation, or commenting** — Inforiver's own documentation (§2.2) advertises write-back to databases/shared drives, manual data entry, and dynamic commenting as core, license-gated features; this visual has none of that surface area by design (`README.md`: "a presentation layer, not an accounting engine").
- **No visual-level formula/calculation authoring** — Inforiver documents an in-visual formula editor and "visual-level formula & calculations"; Zebra BI's own page likewise advertises a "formula editor" to "add new elements." This visual instead requires every calculated value (including presentation subtotals) to already exist as a model measure (`docs/AUTHORING.md`, "Totals, periods and sparse data": "No automatic statement grand total... No automatic period total column").
- **No in-visual chart/table toggle or embedded inline charts** — Zebra BI's page advertises "tables with embedded charts" and a chart/table toggle slider; this visual is DOM-table-only.
- **No forecasting/what-if/multi-plan comparison authoring surface** — both competitors advertise forecast/what-if/scenario-switch features; this visual's three scenario slots (Actual/Budget/Prior) are fixed, separately bound measures with no in-visual scenario editor (`README.md`, "Bind the visual": "Scenarios are separate bound measures, not a scenario grouping").
- **No IBCS-compliance claim** — Zebra BI's own page claims first/only IBCS-certified status (vendor claim, not verified here); this repository's README explicitly disclaims any "IBCS compliance" implication at the top of the file.
- **No runtime entitlement enforcement** — Inforiver's AppSource install flow requires entering a license key in-visual; this repository has no license gate, license server, or in-visual purchase/activation path (`capabilities.json` requests no privileges). The owner's 2026-09-10 decision explicitly uses external Atlyn storefront subscriptions with an ungated runtime and free shared viewing. Absence of runtime checks does not mean absence of a commercial acquisition model or first-party distribution obligations.

### 4.3 Concrete, currently-open certification/AppSource submission gaps found by this research

**Research-time snapshot, not the final candidate gate state:** implementation continued concurrently. The official ESLint plugin/script, real packaged listing screenshots and other local deliverables were subsequently added. Use `SUBMISSION-DOSSIER.md`, the final manifest and preserved command results for current status; a genuine PBIX and owner/native approvals remain separate requirements.

These are observable facts about the current repository state versus §1's documented requirements — **not a certification verdict**, and every item already appears in some form on the existing `docs/PUBLICATION-CHECKLIST.md` legal/host gates; this list narrows to the specific technical file/branch/asset items §1 calls out by name:

1. **No `certification` branch.** `git branch -a` in this worktree shows only `main`, `garrett-hamers-financial-matrix-release-quality`, and `garrett-hamers-atlyn-financial-matrix-implementation` (plus their `origin/*` refs) — no branch literally named `certification` (lowercase) exists yet, which §1.1 requires to exist and match the submitted package before certification (not before AppSource listing) can be requested.
2. **`eslint-plugin-powerbi-visuals` is not installed.** `package.json`'s `devDependencies` list `eslint`, `typescript`, and `typescript-eslint`, but not `eslint-plugin-powerbi-visuals`, and the `lint` script is `"eslint src tests scripts samples/check-sources.mjs"`, not the literal `"npx eslint . --ext .js,.jsx,.ts,.tsx"` string §1.1 documents as a file requirement. `eslint.config.mjs` uses `@eslint/js` + `typescript-eslint` only — no Power BI-visuals-specific ESLint rule set is currently wired in, so lint currently cannot be said to check the certification-specific rules that plugin encodes.
3. **No sample `.pbix`/`.pbip` file exists in the repository** (confirmed by `glob **/*.pbix` returning no matches on 2026-09-09), which §1.2 and §1.5 (Marketplace policy §1180.2) both list as a **required** AppSource submission asset, not merely a certification nicety. `README.md` and `docs/PUBLICATION-CHECKLIST.md` already flag this as a pending, separately-owned gate ("The sample contains Power Query M, DAX, line-metadata JSON and expected results, not a PBIX/PBIP"; another agent owns that offline PBIP track per this task's scope) — this research does not change that ownership, it only cross-confirms the requirement's exact source and wording.
4. **Screenshots, EULA, privacy-policy URL, and support URL are not yet prepared as AppSource listing assets.** `pbiviz.json` already sets a `supportUrl` (`https://www.atlynco.com/docs/faq`) and author email, but that URL's suitability for AppSource's separately-configured "Support document link" and "Privacy document link" fields (§1.2/§1.6) is explicitly called out as unresolved in `docs/PUBLICATION-CHECKLIST.md`'s "Legal, organizational and public-distribution gate" — this research confirms those are two distinct required Partner Center fields (support link and privacy link), not one combined field.
5. **`npm audit` severity threshold.** §1.1 states certification requires `npm audit` to return no **high or moderate** advisories; `docs/PUBLICATION-CHECKLIST.md` already records "0 advisories" for both `npm audit --omit=dev` and `npm run audit:tooling" as of the same 2026-09-09 snapshot — noted here only to confirm that existing recorded evidence already targets the correct severity bar, it is not new evidence produced by this document.

None of items 1–5 above imply the visual would fail review; they are simply concrete, source-cited deltas between what §1 documents as required at submission/certification time and what currently exists in this checked-out worktree, offered so the publication checklist's existing gates can be actioned with exact citations.
