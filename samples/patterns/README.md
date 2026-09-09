# Optional balance-sheet and cash-flow pages

These are explicit, reproducible **representable patterns**, not a full accounting engine or a claim of accounting-standard compliance. They reuse the base sample's `Period` table, use separate disconnected one-level line dimensions and supply every value through DAX. No balance is calculated by the visual.

All data is synthetic and embedded in Power Query. The BS cash snapshots reconcile to the CF opening/movement/closing bridge, but the P&L and changes in equity are **not** a fully integrated three-statement model. Operating cash flows are already classified source amounts, not automatically derived from operating profit.

## Sources and Desktop assembly

Complete the [base P&L sample](../README.md) first.

1. In Power Query Editor, create four **Blank Queries**, rename exactly as below and replace Advanced Editor contents with the corresponding source:

   | Query | Source | Loaded rows |
   | --- | --- | ---: |
   | `BalanceFact` | [BalanceFact.pq](BalanceFact.pq) | 63 |
   | `BalanceLines` | [BalanceLines.pq](BalanceLines.pq) | 10 |
   | `CashFlowFact` | [CashFlowFact.pq](CashFlowFact.pq) | 36 |
   | `CashFlowLines` | [CashFlowLines.pq](CashFlowLines.pq) | 7 |

2. **Close & Apply**. Add these active **one-to-many, single-direction** relationships:
   - `Period[PeriodKey]` → `BalanceFact[PeriodKey]`
   - `Period[PeriodKey]` → `CashFlowFact[PeriodKey]`
3. Leave both line tables disconnected. Do not relate the facts to each other or to P&L Accounts. Ensure there are no other auto-detected relationships.
4. Sort `BalanceLines[LineID]` by `BalanceLines[LineOrder]`; sort `CashFlowLines[LineID]` by `CashFlowLines[LineOrder]`. Use Whole number for keys/order and Decimal number for Amount.
5. Create each `Name = expression` block in [Balance-measures.dax](Balance-measures.dax) as a separate measure, in file order, with `BalanceFact` as home table:
   - `Balance Amount`, `Balance at Period End`, `Balance Sheet Value`, `BS Actual`, `BS Budget`, `BS Prior`.
6. Then create the blocks in [CashFlow-measures.dax](CashFlow-measures.dax), with `CashFlowFact` as home table:
   - `Cash Flow Amount`, `Cash Flow Value`, `CF Actual`, `CF Budget`, `CF Prior`.
7. Optionally hide raw Scenario/Amount/key/order columns and internal helper measures after assembly. Bind only the named public scenario measures below.

### Balance sheet page

Create a page named **Balance sheet** using the same 1600 × 900 layout and Period slicer as P&L. Title: **Synthetic balance sheet — period-end snapshots**.

| Visual role | Binding |
| --- | --- |
| Line ID hierarchy | `BalanceLines[LineID]` only |
| Period | `Period[Period]` |
| Actual | `[BS Actual]` |
| Budget | `[BS Budget]` |
| Prior period | `[BS Prior]` |

Paste [balance-line-metadata.json](balance-line-metadata.json) into **Statement → Line metadata JSON**. Leave eligible variances on and RTL off. All amounts use explicit currency formats and `favorable: "neutral"`: the visual does not decide that a larger asset, debt balance or equity movement is inherently better.

### Cash flow page

Create a page named **Cash flow**, same layout/slicer. Title: **Synthetic cash bridge — contiguous periods only**.

| Visual role | Binding |
| --- | --- |
| Line ID hierarchy | `CashFlowLines[LineID]` only |
| Period | `Period[Period]` |
| Actual | `[CF Actual]` |
| Budget | `[CF Budget]` |
| Prior period | `[CF Prior]` |

Paste [cash-flow-line-metadata.json](cash-flow-line-metadata.json) into the metadata setting. Here investing/other outflows are **already signed in the facts**, so their metadata uses `sign: 1`; applying `-1` would incorrectly invert them. This is intentionally different from the P&L positive-cost convention.

The exact role/layout configuration for both pages is also in [report-layout.json](../report-layout.json), a manual recipe rather than a Power BI importable file.

## Balance-sheet semantics

`Balance at Period End` selects the **last selected reporting period**, removes only Period filters and reapplies that single PeriodKey. The scenario filter remains intact. `Balance Sheet Value` then selects specific accounts or explicit sets of asset/liability/equity facts.

- Cash, receivables, inventory and fixed assets are individual snapshot balances.
- **Total assets** sums those base asset facts at the selected closing period.
- **Total liabilities and equity** sums its base facts at that period.
- **Balance check** is explicit assets minus liabilities/equity, expected zero.
- Outside `BalanceLines[LineID]` scope the measure is blank. There is no automatic total of all statement rows.
- With Period unbound and Jan–Mar selected, Actual assets are **226,000** and cash **73,000** (March ending values), not the sum of monthly snapshots. All three scenario measures follow the same period rule.

The sample assumes the displayed balances are already normalized positive assets/liabilities/equity. A real ledger may use debit/credit signs; normalize in the model or choose an explicit display sign without double conversion. Carry-forward, latest-known balance, fiscal dates, consolidation and FX are not inferred.

## Cash-flow semantics

`CashFlowFact` contains a period's opening cash plus three **already classified signed movements**. The model keeps stock and flow semantics separate:

- **Opening cash**: opening value from the first selected period only.
- **Operating / investing / financing**: their own base movement facts over the selected period context.
- **Net change in cash**: sum of movement facts **excluding** `"Opening"`; it does not sum displayed lines.
- **Closing cash**: cash from `BalanceFact` at the last selected period, not a visual running total.
- **Cash bridge check**: opening + net change − closing, expected zero.

Scenario measures filter **both** CashFlowFact and BalanceFact. Otherwise the closing balance would mix scenarios. No relationship or implicit aggregation is used to infer that alignment.

The sample requires a **contiguous selection** when Period is unbound. The model checks the dense `PeriodSort` sequence; selecting January and March but excluding February makes the combined CF measure blank rather than inventing a bridge over omitted flows. When Period is bound, each month's own context is a valid one-period bridge. If extending this sample, maintain a dense chronological PeriodSort and define an explicit missing-period/completeness policy.

## Expected checks

[expected-results.csv](expected-results.csv) records all period/scenario asset totals and cash bridges. Examples:

| Actual | January | February | March |
| --- | ---: | ---: | ---: |
| Total assets | 200,000 | 214,000 | 226,000 |
| Total liabilities and equity | 200,000 | 214,000 | 226,000 |
| Opening cash | 45,000 | 50,000 | 62,000 |
| Operating cash | 12,000 | 20,000 | 18,000 |
| Investing cash | -10,000 | -12,000 | -11,000 |
| Financing cash | 3,000 | 4,000 | 4,000 |
| Net change | 5,000 | 12,000 | 11,000 |
| Closing cash | 50,000 | 62,000 | 73,000 |
| Balance / cash bridge checks | 0 / 0 | 0 / 0 | 0 / 0 |

For a copy with Period unbound and **all three months** selected:

| Scenario | Opening | Net movements | Closing | Cash bridge check |
| --- | ---: | ---: | ---: | ---: |
| Actual | 45,000 | 28,000 | 73,000 | 0 |
| Budget | 46,000 | 24,000 | 70,000 | 0 |
| Prior | 37,000 | 9,000 | 46,000 | 0 |

Validate in Desktop against native matrix results and the CSV. These are intended arithmetic baselines, not previously observed Desktop/service output. Snapshot and cash-flow totals are named **presentation subtotal** lines with authoritative measures, not automatic matrix totals.

## Extending the patterns responsibly

- Add account mappings and explicit measures for taxes, provisions, retained earnings, noncash adjustments, financing detail, acquisitions or FX effects as needed.
- If a movement belongs to multiple displayed groups, prevent double counting in **base-fact mappings**; never sum a statement table to compensate.
- Indirect cash flow needs model-calculated profit/noncash/working-capital adjustments and an explicit cash reconciliation. This sample does not derive them from labels or balance differences.
- Add hierarchy levels using stable globally unique IDs and `ISINSCOPE` parent branches, as in the P&L source. Every delivered parent/leaf needs metadata.
- Add percentage/KPI lines with numeric model calculations, `unit: "percent"` and only `none`/`absolute` variance. Do not sum snapshots, rates or distinct counts.
- Multi-currency balances and movements require consistent reporting-currency conversions in the model.
