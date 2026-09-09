# Offline sample: recreate the report in Desktop

This folder is the **sample model/report source**. It contains inline Power Query M data, DAX measures, visual metadata, expected results and a precise manual assembly recipe. It is **not a PBIX or importable PBIP**, and has **not been executed/validated in Power BI Desktop or the service**. Do not rename any source file to `.pbix`.

The sample can be recreated/refreshed without a network connection after Desktop and the built `.pbiviz` are available. There are no external data sources, credentials, parameters, `File.Contents` paths or web queries. Query contents are pasted into Desktop; source-file paths are instructions for the author, not runtime model dependencies.

## What is included

| Source | Purpose |
| --- | --- |
| [pnl/Period.pq](pnl/Period.pq) | Three reporting periods, Jan–Mar 2025. |
| [pnl/Accounts.pq](pnl/Accounts.pq) | Eight explicit account mappings. |
| [pnl/Facts.pq](pnl/Facts.pq) | Thirty synthetic seed rows; unpivoted into 87 non-null scenario facts. |
| [pnl/StatementLines.pq](pnl/StatementLines.pq) | Thirteen leaf records grouped under five section IDs; disconnected. |
| [pnl/Statement-measures.dax](pnl/Statement-measures.dax) | Five model measures, including separate Actual/Budget/Prior bindings. |
| [pnl/line-metadata.json](pnl/line-metadata.json) | All 18 parent/leaf metadata entries, with explicit mixed-unit formats. |
| [pnl/expected-results.csv](pnl/expected-results.csv) | Raw model values for every configured node in all three periods. |
| [pnl/expected-variances.csv](pnl/expected-variances.csv) | Display-sign/variance examples, including missing and zero reference. |
| [pnl/Inspect-model.dax](pnl/Inspect-model.dax) | Optional Desktop DAX query-view checks for leaf/parent/all-period scope. |
| [report-layout.json](report-layout.json) | Machine-readable **manual assembly recipe**, not a Power BI import schema. |
| [patterns/README.md](patterns/README.md) | Optional fully sourced balance-sheet and cash-flow pages. |
| [check-sources.mjs](check-sources.mjs) | Dependency-free source/arithmetic consistency checks; not an M/DAX engine. |

All values are illustrative USD reporting amounts. Revenue and expenses are stored positive in the P&L facts; the measure subtracts costs for profit, and the visual displays expense lines using `sign: -1`. Prior is an explicitly supplied **aligned prior-year comparator**: `Prior` on Jan 2025 represents Jan 2024, and similarly for February/March. It is not a date-shifting visual calculation. The monthly Period table is deliberately not a daily calendar/time-intelligence table.

This is an **operating P&L**, through operating profit, not a complete statutory income statement. No interest/tax/net-income, consolidation, accrual, currency translation or accounting-standard engine is supplied.

## 1. Create the four query tables

1. Open a new local report in Power BI Desktop.
2. Choose **Home → Transform data** to open Power Query Editor.
3. Choose **Home → New Source → Blank Query**.
4. Rename the query **`Period`** in Query Settings.
5. Open **Home → Advanced Editor**, replace the entire existing expression with the contents of `pnl\Period.pq`, and choose **Done**.
6. Repeat steps 3–5 for these exact names and sources:

   | Query name | Paste this source |
   | --- | --- |
   | `Accounts` | `pnl\Accounts.pq` |
   | `Facts` | `pnl\Facts.pq` |
   | `StatementLines` | `pnl\StatementLines.pq` |

7. Leave **Enable load** on for all four queries. Choose **Close & Apply**.
8. In Table/Data view, check row counts: Period **3**, Accounts **8**, Facts **87**, StatementLines **13**.

`Table.Unpivot` omits null values. That omission deliberately leaves all three `LAUNCH` Prior comparisons without a fact. January's Budget `0` remains an actual numeric fact. No empty string or zero substitutes for a missing amount.

## 2. Configure the model exactly

In **Model view → Manage relationships**, create/verify only these relationships for the base sample. Remove any auto-detected relationship not listed here:

| One side | Many side | Active | Cross-filter direction |
| --- | --- | --- | --- |
| `Period[PeriodKey]` | `Facts[PeriodKey]` | Yes | Single, Period → Facts |
| `Accounts[AccountID]` | `Facts[AccountID]` | Yes | Single, Accounts → Facts |

**StatementLines has no relationships.** In particular, never relate its IDs to Facts or Accounts and never enable bidirectional filtering for this sample. No relationship connects the Scenario column to a report grouping.

Confirm types:

- Keys/order columns: **Whole number**.
- `Facts[Amount]`: **Decimal number**.
- IDs, labels, Period caption, StatementClass and Scenario: **Text**.

Set **Column tools → Sort by column**:

| Column | Sort column |
| --- | --- |
| `Period[Period]` | `Period[PeriodSort]` |
| `StatementLines[SectionID]` | `StatementLines[SectionOrder]` |
| `StatementLines[LineID]` | `StatementLines[LineOrder]` |

Set numeric key/order columns and `Facts[Amount]` to **Don't summarize** where offered; bound values will be explicit measures. Do not mark this monthly Period table as a daily date table.

## 3. Create five DAX measures

Use **Modeling → New measure** and `Facts` as the home table. Open `pnl\Statement-measures.dax`; create these **separately, in this order**, pasting each complete `Name = expression` block:

1. `Fact Amount`
2. `Statement Value`
3. `Actual`
4. `Budget`
5. `Prior`

The `.dax` file contains several measure definitions for copying; it is not a single expression to paste into one measure. Use Desktop's default DAX separators (commas in these sources); if your installation uses localized separators, switch to the default separator option or translate separators consistently.

Keep these measures numeric. Set Actual, Budget and Prior to the model format `#,0.00;(#,0.00);0.00` if desired as a host-format fallback. **Do not use DAX `FORMAT`.** The sample visual's per-line JSON formats override the generic measure format.

Optional tidying: hide `Fact Amount`, `Statement Value`, raw fact keys/Scenario/Amount, and order columns from report view after configuring sorting. Do not delete them or hide the public bound measures/ID fields before assembling the visual.

Why the measure is written this way:

- `ISINSCOPE(LineID)` distinguishes a real leaf from a section that happens to contain one selected child; `SELECTEDVALUE` alone cannot.
- `ISINSCOPE(SectionID)` resolves explicit model parent values; at overall statement scope it returns blank.
- Revenue/cost parents aggregate only the relevant **account facts**.
- Gross/operating profit are explicit arithmetic on base facts. Their presentation subtotal rows are not added back to any fact aggregate.
- Margins use `DIVIDE(profit, revenue)`. Active customers use `DISTINCTCOUNT` on revenue facts, excluding blank customer IDs and zero-valued revenue facts.
- Missing required profit components return blank instead of being treated as zero. A class total is still a sum of the facts that exist; detecting every missing account or incomplete accounting period is a production-model responsibility.

## 4. Assemble the P&L page

Import the built package following [the build/import guide](../docs/BUILD-AND-IMPORT.md).

1. Rename the report page **P&L**.
2. On the page's **Format → Canvas settings/Page size**, choose **Custom**, width **1600**, height **900**.
3. Insert a text box: **Synthetic operating P&L — reporting currency USD**. Set its position/size to X **24**, Y **8**, width **1552**, height **36**.
4. Add a native slicer using `Period[Period]`. Set X **24**, Y **48**, width **1552**, height **64**. Use a horizontal/tile layout where available; leave all three months selected (or clear the slicer to mean all three).
5. Add **Atlyn Financial Matrix** at X **24**, Y **120**, width **1552**, height **752**. Position/size fields are under the visual's General properties in current Desktop UI.
6. Bind **exactly**:

   | Role | Field/measure |
   | --- | --- |
   | Line ID hierarchy, first | `StatementLines[SectionID]` |
   | Line ID hierarchy, second | `StatementLines[LineID]` |
   | Period | `Period[Period]` |
   | Actual | `[Actual]` |
   | Budget | `[Budget]` |
   | Prior period | `[Prior]` |

7. Open **Format visual → Statement → Line metadata JSON**. Paste the entire contents of `pnl\line-metadata.json`. Set **Show eligible variances** on and **Right-to-left layout** off.
8. Use the **Power BI host visual-header hierarchy command “Expand all down one level in the hierarchy”** if Desktop initially queries only SectionID. The target query includes **both** SectionID and LineID. Do not use a drill mode that replaces the hierarchy with just the child level when checking parent values.
9. Once the host delivers descendants, the visual's own `+`/`-` controls locally collapse/expand them. These local controls cannot request a missing hierarchy level. If your Desktop build does not deliver both levels/expose the host command, record that as a host integration issue; do not interpret an empty local expansion as a complete sample.
10. Save locally as, for example, **Atlyn Financial Matrix sample.pbix** in a location you choose. Saving an actual Desktop file is a manual output of this recipe, not an artifact supplied by this repository.

The layout is also recorded in `report-layout.json`; it has no automatic importer. At three periods with all comparators, horizontal scrolling is expected at this page width. The header/first column should remain sticky. Do not interpret the visible viewport as the full bounded table or a full export.

The five section parents plus thirteen leaves produce **18 row nodes** when fully delivered/expanded. They use **21 value columns** (seven per period) and **378 row × value-column cells**, well within the view limits. Rows without eligible variances leave those positions unpopulated; heading parents have no displayed numbers.

## 5. Check the intended results in Desktop

These are **expected**, not previously Desktop-observed, results:

| Line | Jan Actual | Jan Budget | Jan Prior |
| --- | ---: | ---: | ---: |
| Revenue | $126,200 | $120,000 | $105,000 |
| New product revenue | $1,200 | $0 | `-` |
| Cost of sales | ($55,000) | ($53,000) | ($49,000) |
| Materials | ($45,000) | ($42,000) | ($40,000) |
| Gross profit | $71,200 | $67,000 | $56,000 |
| Gross margin | 56.4% | 55.8% | 53.3% |
| Operating expenses | ($40,000) | ($40,000) | ($36,500) |
| Operating profit | $31,200 | $27,000 | $19,500 |
| Operating margin | 24.7% | 22.5% | 18.6% |
| Active customers (distinct) | 3 | 3 | 3 |

Values/captions are illustrative English/US display expectations; host locale can change separators.

- Materials vs Budget: **-3,000**, unfavorable; relative delta approximately **-7.14%**. Metadata uses `sign: -1` and `favorable: "higher"`; do not invert expenses in DAX too.
- New product revenue vs Budget: absolute **1,200**, relative **N/A** because the reference is zero. Against Prior, comparisons are missing, not 100% growth.
- Gross margin vs Budget: approximately **+0.585 percentage points** before rounding, **+0.6 pp** at one decimal, not relative growth.
- March delivery vs Budget: absolute **0** and relative **0%**, not missing.
- Both heading parents show no values. Gross/operating profit are styled subtotal lines but are ordinary explicitly modeled leaf IDs.

`expected-results.csv` contains **raw** measure values: expense rows are positive there, percent rows are fractions, and empty CSV fields mean DAX blank. `expected-variances.csv` contains signed display values; its absolute variance is in percentage points for percent rows, ordinary displayed units otherwise. Relative values are numeric fractions; empty means ineligible/missing, and `N/A` means zero reference.

To inspect values without visual formatting:

1. Create a **Model checks** page with a native Matrix: rows SectionID then LineID; columns Period; values Actual, Budget, Prior.
2. Expand all hierarchy levels using the native Matrix's host control. Inspect raw values against the CSV. Native Matrix styling/signs need not match Atlyn's per-line formatting.
3. If Desktop has **DAX query view**, run `pnl\Inspect-model.dax`. It checks leaf, parent and all-month contexts. All-blank heading rows are suppressed by `SUMMARIZECOLUMNS`, as noted in the source; their descendants still establish the grouping in a hierarchy query.
4. Temporarily remove Period from an Atlyn copy (keep all months selected). The model's active-customer value is **4**, not **9**: some customers appear in more than one month. Margins are recomputed from all selected facts, never summed/averaged from monthly margin rows.
5. Restore the original Period binding and all three months for the baseline report.

## 6. Optional BS/CF pages and host interactions

Continue with [the balance-sheet/cash-flow recipe](patterns/README.md). It reuses Period and adds four query tables, explicit measures and two metadata arrays; all source remains offline.

For host selection testing, use another visual grouped by Period with an actual fact measure. A selected **period** identity can affect it. StatementLines is disconnected, so selecting a statement ID does **not** automatically select that ID's account transactions. Configure a drillthrough destination deliberately using the bound fields `StatementLines[LineID]` and `Period[Period]` to check identity transport; an account transaction destination needs an additional model mapping, not label inference.

Run the [Desktop/service publication checklist](../docs/PUBLICATION-CHECKLIST.md) for native tooltips/highlights, filtering, keyboard/high contrast, drillthrough, export, bookmarks and tenant policy. Mock-host browser tests do not certify those behaviors.

## Source consistency check (no dependencies or Desktop)

From the repository root with Node installed:

```powershell
node .\samples\check-sources.mjs
```

This reads only checked-in sample files. It checks metadata coverage/schema/order, the literal inline sample rows, expected arithmetic/sign/variance results, distinct-count nonadditivity, balanced snapshot totals and cash bridges. It **does not parse arbitrary M, run the Power Query/DAX engines, build the visual, or validate Desktop/report rendering**. It must not be reported as Desktop validation.

## Limits of this sample

- No fake binary or partially generated PBIP; the report must be assembled and saved in Desktop.
- The hierarchy query shape, blank headings and native subtotal delivery remain real-host acceptance items.
- The synthetic P&L, BS and CF illustrate supported presentation patterns. They are not a reconciled full three-statement accounting model.
- No ETL connector, account-mapping editor, multi-currency engine, missing-period fill, RLS design, forecast/versioning system or writeback.
- The metadata must be maintained with the model when IDs/lines change. No label-based matching or aggregation rescues missing/duplicate IDs.
