# Fully bound offline PBIP sample

The generated project contains an enhanced PBIR report and a TMDL semantic model, with every table, measure, relationship, page, visual role and line setting already bound. **Build and open `dist\sample-report\AtlynFinancialMatrix.pbip`**, not the source template (which intentionally excludes the generated visual resources).

No genuine PBIX has been produced here. Local checks include Microsoft's actual TMDL parser, but do not execute M/DAX, open Desktop, render a native report or prove service acceptance. The coordinator owns those remaining gates.

## Reproduce

Prerequisites: the visual's Node/npm/Chromium toolchain and **.NET SDK 8 or newer** for local TMDL parsing. The validator targets .NET 8 and allows a newer runtime; this environment uses SDK 10.0.401. Initial NuGet acquisition needs network access, just like initial npm/browser acquisition. The model's own data refresh uses only inline synthetic sources.

```powershell
npm run package
npm run sample:build
npm run sample:validate
```

`sample:build` copies authored files from `samples\pbip`, excluding the schema cache/placeholders, into the ignored `dist\sample-report` directory. It preserves the **complete official PBIVIZ byte-for-byte** in `VisualPackage`, and copies the official manifest/resource entries without modification into the report's `CustomVisuals\<GUID>` folder. It does not edit or repackage the PBIVIZ.

`sample:validate` checks cached Microsoft JSON schemas, canonical source identity, semantic text-literal encoding, bindings, active line projections, report resource registration, generated/source equality and exact package/resource hashes. It then invokes pinned **Microsoft.AnalysisServices 19.117.0 `TmdlSerializer.DeserializeDatabaseFromFolder`**, checking the actual parsed tables, measures, import partitions and active one-direction many-to-one relationships. NuGet dependency versions/content hashes are locked in `scripts\tmdl\packages.lock.json`.

The parser is necessary: JSON-schema/byte-comparison checks alone missed invalid TMDL comments and annotation scope during development. They also could not establish that an unquoted text literal or a PBIVIZ ZIP labeled as `CustomVisualMetadata` was valid native report wiring. These defects were corrected before delivery.

.NET CLI home, NuGet package/HTTP/scratch caches and build output are redirected to ignored `.tmp` locations. The wrapper disables CLI telemetry, ASP.NET certificate generation and shared compiler/build servers. These are development-only dependencies; no .NET assemblies or authentication dependencies are shipped in the visual.

## Generated structure

```text
dist\sample-report\
  AtlynFinancialMatrix.pbip
  VisualPackage\<official visual>.pbiviz
  AtlynFinancialMatrix.SemanticModel\
    definition.pbism, .platform
    definition\database.tmdl, model.tmdl, relationships.tmdl, tables\*.tmdl
  AtlynFinancialMatrix.Report\
    definition.pbir, .platform
    definition\version.json, report.json, pages\...
    CustomVisuals\<GUID>\
      package.json
      resources\<GUID>.pbiviz.json
```

The source-only schema cache is under `samples\pbip\schema`, with Microsoft's original MIT license. It is omitted from the generated report. `dist\sample-report-build.json`, `dist\sample-validation.json` and `dist\tmdl-validation.json` record the exact local results.

## Native preflight correction: required version metadata

The coordinator's unmodified sealed sample failed to open in Desktop 2.157.1354.0 with **Cannot find file 'version.json'**. The original checker validated files that existed, but did not require this PBIR entry file. The quality-branch sample now includes `AtlynFinancialMatrix.Report\definition\version.json`, using Microsoft's [versionMetadata schema](https://developer.microsoft.com/json-schemas/fabric/item/report/definition/versionMetadata/1.0.0/schema.json) and report-definition version `2.0.0`, as also present in a [concrete PBIR version file](https://github.com/ProdataSQL/FinancialModelling/blob/ec738ceb6a801f416b88b93c1dcfddbbe89426b7/Workspace/Finance-GL.Report/definition/version.json).

This is the **report format version**, not the visual package version. Preflight now checks required entry files in both source and generated projects, plus listed page definitions. Regression cases cover missing/version-as-directory metadata and substituting a visual version. A distinct provisional sample is supplied for coordinator retry using the exact current PBIVIZ bytes; the sealed dossier and certification ref are not changed. A successful local preflight is still not evidence of a successful native open/refresh/render.

For this sample-only retry, **skip `npm run package`** and use the existing sealed package with `npm run sample:build` and `npm run sample:validate`. Rebuilding the official ZIP can change its hash even when runtime source is unchanged.

## Model and pages

Eight tables reuse the existing M/DAX sources: `Period`, `Accounts`, `Facts`, `StatementLines`, `BalanceFact`, `BalanceLines`, `CashFlowFact`, `CashFlowLines`. All sixteen measures have actual expressions; none are placeholders. Four relationships connect Period to each fact table and Accounts to Facts. The three statement-line tables remain disconnected. Sort-by columns, hidden helpers and `summarizeBy: none` follow the canonical sample recipe.

The report references its local semantic model through `datasetReference.byPath`; no remote dataset ID, connector credentials or machine-specific data path is required.

| Page | Binding and purpose |
| --- | --- |
| ProfitAndLoss | SectionID then LineID; `Facts[Actual/Budget/Prior]`; complete P&L metadata, with both line fields active and authored expansion levels. |
| BalanceSheet | BalanceLines[LineID]; `BalanceFact[BS Actual/BS Budget/BS Prior]`; period-end stock/snapshot pattern. |
| CashFlow | CashFlowLines[LineID]; `CashFlowFact[CF Actual/CF Budget/CF Prior]`; explicit cash bridge. |
| ModelChecks | Native `pivotTable` matrix on the P&L hierarchy/Period with the three supplied measures, for raw model-result cross-checking rather than mixed-row presentation formatting. |

Each page is 1600 x 900 with title, Period slicer, visible sample usage tips and the statement/native matrix at the positions in `samples\report-layout.json`. The custom-visual pages call out Desktop refresh/save prerequisites, field-role bindings, line-metadata formatting, local expansion limits and native context-menu/drillthrough requirements. All five custom roles are bound. Metadata is a correctly single-quoted SQ text literal (embedded apostrophes doubled); decoding it yields the canonical JSON byte-for-byte. Variances are enabled and RTL is initially off.

## Resource and binding evidence

Microsoft documents private visual metadata under `CustomVisuals` in the [project report-folder specification](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report). Its [Log Analytics sample's custom-visual manifest](https://github.com/microsoft/PowerBI-LogAnalytics-Template-Reports/blob/787064bfc54f26c0af32e7f16b8de504effb8228/PBIASEngine/src/Report/CustomVisuals/asTimeline3ECFC8FDEB264A3ABB1C0E31EC19FE14/package.json) demonstrates the manifest plus `resources\<GUID>.pbiviz.json` layout.

A concrete, published [PBIR report definition](https://github.com/ProdataSQL/FinancialModelling/blob/ec738ceb6a801f416b88b93c1dcfddbbe89426b7/Workspace/Finance-GL.Report/definition/report.json) registers the GUID-named CustomVisual resource package and `<GUID>.pbiviz.json` metadata item. That repository's [native report](https://github.com/ProdataSQL/FinancialModelling/blob/ec738ceb6a801f416b88b93c1dcfddbbe89426b7/Workspace/01_P%26L_ParentChild.Report/report.json) also demonstrates `pivotTable`, active hierarchy projections and quoted semantic literals. These are format/protocol references, not imported visual code, a license for Atlyn code or proof that our project has opened in Desktop.

## Coordinator-owned native acceptance

Open the generated PBIP in a compatible Desktop version (enable the relevant PBIP/PBIR preview support if required by that version). Refresh inline tables, compare every P&L/BS/CF measure with the supplied expected results, inspect both delivered hierarchy levels, and save/hash a genuine offline PBIX. Confirm slicer/title/native-matrix appearance, private-visual loading, subtotal shapes and all host interactions.

PBIR schemas are permissive around native formatting. The empty/default theme, textbox/native slicer presentation and exact native hierarchy-query behavior still need Desktop observation. There is no unsupported assertion that schema validation proves those behaviors. Local `+`/`-` only hides or reveals already-delivered rows; persisted initial report expansion is a host report setting, not new runtime drill/fetch functionality.

See [the manual source recipe](../samples/README.md) for accounting/model rationale and [the publication checklist](PUBLICATION-CHECKLIST.md) for native, legal and submission gates. No manual field binding is required to construct the generated project; native corrections, if discovered, must be recorded rather than silently treated as a prior pass.
