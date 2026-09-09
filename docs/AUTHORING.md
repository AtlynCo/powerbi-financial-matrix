# Authoring Atlyn Financial Matrix v1

## Model-first contract

The visual displays what Power BI's matrix query delivers. It does not infer accounts from captions, convert currencies, calculate financial statement totals, perform eliminations, roll forward balances, or aggregate statement lines.

Bind one to six **text Line ID hierarchy** columns to `Lines`, outermost first; an optional single grouping to `Period`; one numeric measure to `Actual`; and optionally one numeric measure each to `Budget` and `Prior`. Do not bind `Scenario` to a grouping role. A fact-table scenario column is fine: expose separate measures that filter it.

Each bound scenario must resolve to its own nonempty host measure `queryName`. Reusing the same underlying measure identity across scenario roles is rejected; create separate named wrapper measures if two scenarios intentionally use the same expression. Duplicate delivered period groups are also rejected, not merged. These checks concern host field/group identities, not a request to hand-edit host query metadata.

Use a disconnected statement-line table and a scope-aware model measure. At a leaf, resolve the leaf ID; at a parent, resolve that parent's ID; outside the statement hierarchy return `BLANK()`. Aggregate **underlying account facts**, never the disconnected statement rows. See [the complete P&L source](../samples/pnl/Statement-measures.dax).

Every delivered ordinary matrix node must have a nonempty string ID that is globally stable and unique across hierarchy paths. A dimension table can repeat a parent ID on several leaf records: Power BI groups those records into one parent node. It cannot deliver the same child ID beneath two different parents. Repeating the same row across **period columns** is permitted. Do not use captions, localized labels, numeric IDs, blank IDs, or a repeated generic `"Total"` as node IDs.

## Statement format card

In **Format visual → Statement**:

- **Line metadata JSON**: paste a JSON array, not a path, URL, object wrapper, DAX expression or JSON-with-comments.
- **Show eligible variances**: enables/disables the display of variances that individual lines have opted into. It does not make an ineligible line eligible.
- **Right-to-left layout**: changes presentation direction. It does not translate author-provided metadata captions or accounting meaning.

Each metadata object has this schema:

| Property | Required | Meaning |
| --- | --- | --- |
| `id` | Yes | Stable string ID, at most 100 characters. |
| `label` | Yes | Display caption, at most 200 characters. Never used for accounting inference. |
| `order` | Yes | Integer; unique among siblings. Ordering is independent of label and host sort order. |
| `type` | Yes | `detail`, `subtotal` or `heading`. |
| `unit` | Yes | `currency`, `percent` or `number`. |
| `format` | No | Explicit Power BI numeric format string, at most 100 characters. |
| `sign` | Yes | Exactly `1` or `-1`. Applied once to raw Actual/Budget/Prior. |
| `favorable` | Yes | `higher`, `lower` or `neutral`, applied to the displayed delta. |
| `variance` | Yes | `none`, `absolute` or `both`; author opt-in, not inferred from type or label. |

The JSON is limited to **256,000 characters and 1,000 entries**. Duplicate config IDs, duplicate JSON properties (including escaped equivalent names), unknown properties, duplicate delivered row IDs, missing metadata, duplicate sibling orders and invalid schema values are rejected rather than silently combined. Errors identify the entry/ID and offending fields where possible. Make orders unique within the parent; global uniqueness is a convenient but unnecessary stricter convention. The [JSON Schema](../samples/line-metadata.schema.json) supports offline editor validation; runtime validation also checks the delivered matrix contract.

Metadata for an ID absent from the current filtered/segmented query is allowed: it may be needed when the filter changes. This is different from a **delivered ID with no metadata**, which is an error. Keep the full intended statement configuration when using slicers, and check spelling against the model ID rather than its caption.

- A **heading** requires `variance: "none"` and displays no numbers, even if the host supplies them.
- A **percent** line allows `none` or `absolute`; `both` is invalid. Feed a numeric fraction such as `0.25`, not a preformatted `"25%"` string or numeric `25`.
- An explicitly authored **presentation subtotal** is an ordinary line with its own stable ID, metadata `type: "subtotal"`, and its own measure result. Its style is not an aggregation instruction.
- A matrix host-generated `isSubtotal` child is different from a presentation subtotal. It does not require a fictional ID or metadata row. The visual can take a parent's host-supplied value directly or from a direct host subtotal child; it will not manufacture a parent by summing descendants.

## Signs, variances and formatting

For raw actual `a`, raw reference `r`, and configured sign `s`:

```text
displayActual = a * s
displayReference = r * s
absoluteVariance = displayActual - displayReference
relativeVariance = absoluteVariance / abs(displayReference)
percentagePointVariance = absoluteVariance * 100  (percent lines only)
```

Both Budget and Prior comparisons use the same policy independently. A zero reference makes the **relative** comparison `N/A`, including `0 / 0`; the absolute comparison remains the numeric delta. A missing actual/reference gives a missing comparison, not zero. Non-finite input produces an invalid value/variance, not an imputed value. Missing cells display `-`; invalid cells display `!`. Undefined, missing and invalid comparisons have no favorable/unfavorable classification. Tooltips expose the unrounded derived numeric result.

Example: raw materials Actual `45,000` and Budget `42,000` with `sign: -1` display `(45,000)` and `(42,000)`. Their displayed delta is `-3,000`, relative delta `-7.14%`, unfavorable when `favorable: "higher"`. If an author instead displays positive expenses with `sign: 1`, use `favorable: "lower"`; do not also invert the raw measure.

For a margin of `0.30` versus `0.25`, an absolute variance is **5.0 percentage points**. It is not 5% relative growth and not 20 percentage points. The model must calculate the margin from base facts, not as an average or sum of delivered margin rows.

Numeric values use Microsoft Power BI formatting utilities. A line's explicit `format` takes precedence; otherwise the cell/measure host format is used. Do not use DAX `FORMAT` for bound values: it returns text. The offline sample uses explicit formats for its mixed currency, percent and ordinary-number lines. Its dollar symbol represents a single illustrative reporting currency; currency selection, exchange rates and conversions belong in the semantic model. Locale may affect separators. Do not assume English formatting proves other locales.

Statement formatting does not apply chart-axis display units or an automatic scientific-notation fallback over an explicit custom format. Scientific/scaled formats are still available when explicitly authored. JavaScript/host numeric values use IEEE-754 precision; the visual cannot recover digits that were not supplied, and long formatted values may be ellipsized with the full value available in titles/native tooltips.

`neutral` disables a favorable/unfavorable interpretation; it does not change the variance arithmetic. Variance columns may exist because another line opts in while a `none` line has no variance values.

## Totals, periods and sparse data

- **No automatic statement grand total:** adding revenue, expenses, ratios, counts and subtotal rows is meaningless.
- **No automatic period total column:** stock balances, rates and distinct counts are not additive. When Period is unbound, any value over the report's current time filter is a model-defined result, not a visual total.
- The visual requests row subtotals using the matrix subtotal API. Power BI's delivered shape is authoritative; missing parent values remain missing. Complementary parent/direct-subtotal cell slots can supply each other without addition. Equivalent value objects are accepted independent of JSON property order; contradictory supplied values are rejected. An empty parent container can use its direct subtotal child's supplied cells. Test hierarchy delivery in Desktop/service.
- No segmentation merge, implicit fetch, missing-period insertion, forward fill, or zero fill is performed.
- Host filter context controls all values. Local row selection does not turn a disconnected line ID into an account filter; use a deliberate model/interaction design.

The [sample's balance-sheet and cash-flow sources](../samples/patterns/README.md) demonstrate last-selected-period snapshots and an explicit opening + movement = closing bridge, rather than summed monthly balances.

## Navigation and host integration

| Input | Action |
| --- | --- |
| Arrow keys | Move focus among displayed cells. |
| Home / End | Move within the current row. |
| Page Up / Page Down | Move through displayed rows. |
| Enter / Space | Select the focused row/cell. |
| Ctrl / Cmd with selection | Multi-select. |
| Escape | Clear selection. |
| `+` / `-` | Locally expand/collapse delivered descendants. |
| Shift+F10 | Open the Power BI context menu. |

Mouse selection and the context menu use native Power BI selection identities. Base scenario cell identities combine the row matrix node, period nodes when present, and the bound measure (`withMatrixNode` / `withMeasure`). Derived variance cells use row + period identity, **not a fake variance measure identity**. A local expansion/collapse is presentation state for delivered data in the current session; it does not fetch children, invoke native query expansion, or create custom drillthrough.

Power BI controls selection propagation, tooltips, highlights and host-defined drillthrough. Configure drillthrough fields on a destination page in Desktop; the visual does not create that destination or guarantee that every field combination is eligible. Report-page tooltips and drillthrough are host-validation gates, not proven by the packaged-browser harness. Right-to-left, high contrast, focus, bookmarks and selection behavior must also be checked in the intended host/tenant.

Statement rows always use explicit sibling `order`, even if the host's query ordering changes. Periods follow the delivered model order; configure the period caption's **Sort by column** using a chronological key. Column headers are not interactive sort controls. Statement format settings belong to the host's formatting model; local expand/collapse and viewport scroll are not persisted native hierarchy/bookmark state. Save/reopen, bookmarks and reset-to-default still require native acceptance.

Host-supplied highlight values are additional context, not replacement totals; variances use the full supplied scenario values. If the host marks a hierarchy node collapsed, a visible notice explains that local controls can only expand descendants already delivered: they do not fetch or drill.

## Size and rendering limits

The table uses bounded vertical row windowing with frozen, two-tier period/scenario headers and a frozen first column. It is not an unlimited spreadsheet:

| Limit | Maximum |
| --- | ---: |
| Row nodes, including delivered hierarchy parents | 1,000 |
| Period groups | 24 |
| Value columns | 168 |
| Displayed row × value-column cells | 24,000 |

Per period, three scenario columns plus up to four variance columns can consume seven columns. The cell budget can therefore restrict visible rows well before the row-node maximum. Oversized axes are clipped at explicit bounds with a notice; partial/segmented host delivery is also disclosed. Filter the semantic model or reduce periods/lines if a notice appears. Collapsing does not recover data the host never delivered and must not be treated as repairing an incomplete view.

Rows are 36px with four overscan rows on each side and a 64px header. Scroll spacers retain the bounded full height; keyboard navigation loads offscreen row windows, and a focused row may be retained separately. ARIA row indices/counts describe the expanded bounded set, not merely the current DOM window. Horizontal columns are bounded but **not column-virtualized**; the widest 168-column view is materially slower than practical statement widths. See [measured evidence](RELEASE-QUALITY.md), not an unlimited-performance claim.

The minimum readable data tile is **256 x 160**. Smaller bound-data tiles show a resize instruction, not a clipped or misleading statement. Row-label width adapts between 96px and 280px so narrow tiles still expose values. Captions remain available through titles/accessible names. The compact footer discloses visible/delivered lines and viewport-only export; **Help** opens the symbol/variance/limit explanation. The empty visual instead shows setup instructions and a copyable metadata example.

In an incomplete/clipped view, a host-supplied parent total can cover more data than the visible descendants. The visual retains that authoritative value; it does not recompute the parent from the remaining visible children.

Scrolling reveals only the bounded delivered view; it is not a full-data export. Export, PDF/PowerPoint output, subscriptions and printing require separate host acceptance checks. Do not claim whole-statement export based on a scrolled screen.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Configuration error / no statement | Valid array JSON; all required fields; unique stable IDs; every parent and leaf covered; unique sibling order. |
| Extra JSON field or repeated property rejected | Remove misspellings/duplicate keys; use only fields in the schema. Object property order is irrelevant. |
| Enlarge visual message | Resize to at least 256 x 160; a financial grid cannot be represented truthfully at 80 x 80. |
| `both` rejected on a margin | Use `unit: "percent"` with `variance: "absolute"` or `none`. |
| Expenses appear favorable when overspent | Inspect raw signs, configured `sign`, and favorable direction against the **displayed** delta. |
| Parent is blank but children have values | Fix the measure's `ISINSCOPE` parent branch and inspect host subtotal delivery; never fix this by summing report rows. |
| Leaf value repeats at a parent | `SELECTEDVALUE(LineID)` alone is insufficient for a one-child parent; choose the ID using `ISINSCOPE`. |
| Budget/Prior not shown | Bind numeric measures to their respective roles, not Scenario as a grouping. |
| Missing value | Confirm the fact/measure is missing rather than zero; `-` is intentional. |
| N/A relative comparison | The reference is zero; the visual does not divide by zero. |
| Fewer rows/periods than expected | Check host segmentation and limit notices; filter the model and re-query. |
| Collapse cannot reveal more children | Only delivered descendants can be expanded locally. |
| Drillthrough unavailable | Check destination fields, selected identity and host/tenant settings in Desktop/service. |
